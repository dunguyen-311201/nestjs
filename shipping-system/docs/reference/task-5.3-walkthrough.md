# Task 5.3 Walkthrough — Terminal exception states + RTS flags

> Tài liệu giải thích tạm thời, viết để review task 5.3. Từ ngữ chuyên
> ngành phổ biến (entity, decorator, abstract, interface, transaction,
> token, enum...) giữ nguyên tiếng Anh, không dịch. File này archive/xoá
> sau khi bạn review xong.

Thứ tự commit: `4d0a23f` (4 transition mới + tests) → `f557713`
(rewrite code comments, không liên quan logic) → `0a01e52` (README) →
`4282fd1` (post-review fix: `DELIVERY_FAILED` self-transition).

Task này **mở rộng** `ParcelStateMachine` từ task 5.2 (`static
transition()` + BR-02 guard) — không sửa lại code cũ, chỉ thêm 4
method/case mới vào cùng file
`apps/order/src/domain/parcel-state-machine.ts`.

---

## 1. Misrouted (BR-02, vế thứ 2) — thêm vào bảng `TRANSITIONS`

Task 5.2 chỉ làm vế 1 của BR-02 (chặn `Out_for_Delivery` nếu chưa qua
`InHub`). Vế 2: nếu parcel bị scan nhầm hub, phải chuyển sang state
`Misrouted` — và đây là **transient state**, không phải terminal:

```ts
[key(ParcelState.IN_TRANSIT, TrackingEventType.MISROUTED)]: ParcelState.MISROUTED,
[key(ParcelState.IN_HUB, TrackingEventType.MISROUTED)]: ParcelState.MISROUTED,
[key(ParcelState.MISROUTED, TrackingEventType.HUB_RECEIVE)]: ParcelState.IN_HUB,
[key(ParcelState.MISROUTED, TrackingEventType.ARRIVED_AT_HUB)]: ParcelState.IN_HUB,
```

- Từ `InTransit`/`InHub`, event `MISROUTED` (nghĩa là parcel bị scan ở
  một hub sai — không phải hub đúng theo `route_id`) đẩy parcel vào
  `Misrouted`, chặn nó tiếp tục theo flow bình thường.
- Từ `Misrouted`, chính 2 event dùng cho forward flow bình thường
  (`HUB_RECEIVE`/`ARRIVED_AT_HUB`) lại đưa nó quay về `InHub` — nghĩa là
  một khi hub staff làm corrective re-route (đưa parcel về đúng tuyến),
  hệ thống coi đó như một cú "hub arrival" bình thường, không cần một
  event type riêng cho việc "sửa sai".
- **Lưu ý:** ai gọi/quyết định một scan là "misrouted" (so sánh hub vừa
  scan với `route_id` đúng của parcel) là việc của Hub/Tracking Service —
  ngoài phạm vi của `ParcelStateMachine`, nó chỉ nhận sẵn event type đã
  được phân loại là `MISROUTED` và tra bảng.

## 2. `markLostSuspected()` — passive SLA-timeout

```ts
static markLostSuspected(currentState: ParcelState): ParcelState {
  if (!ACTIVE_STATES.has(currentState)) {
    throw new Error(`Cannot mark Lost from ${currentState}: ...`);
  }
  return ParcelState.LOST;
}
```

- Đây **không phải** một `TrackingEventType` (không có scan nào tên
  "LOST" trong `TRACKING_EVENT.event_type`'s `CHECK` constraint) — vì lý
  do parcel bị coi là "mất" không phải do ai đó *scan* một sự kiện, mà do
  **không có scan nào cả** trong một khoảng thời gian vượt SLA. Đây là
  passive detection (nhắc lại nguyên tắc scope-cut trong `CLAUDE.md`:
  "a lost parcel is detected passively... not by an active manifest
  count"). Vì bản chất khác nhau (trigger bởi *thiếu* event, không phải
  *có* event), nó cần method riêng thay vì thêm vào bảng `TRANSITIONS`.
- `ACTIVE_STATES` = `{ InTransit, InHub, OutForDelivery, Misrouted }` —
  tức "đang thực sự di chuyển trong mạng lưới." Bị chặn từ `Created`
  (parcel chưa từng dispatch, không có gì để "mất" giữa đường) và từ 3
  terminal state (`Delivered`/`Lost`/`Damaged` — đã kết thúc rồi).
- Ai gọi method này (một sweep job định kỳ so sánh
  `PARCEL.sla_expected_delivery` với thời gian hiện tại) là việc của
  Tracking Service — task **5.5**, chưa build ở đây.

## 3. `applyRts()` — BR-04, sau 3 lần giao thất bại

```ts
export interface RtsResult {
  state: ParcelState;
  direction: ParcelDirection;
}

static applyRts(currentState: ParcelState): RtsResult {
  if (currentState !== ParcelState.OUT_FOR_DELIVERY) {
    throw new Error(`Cannot apply RTS from ${currentState}: ...`);
  }
  return { state: ParcelState.IN_TRANSIT, direction: ParcelDirection.REVERSE_RTS };
}
```

- Trả về một **object** (`RtsResult`) thay vì chỉ 1 `ParcelState`, vì
  BR-04 đổi **2 field cùng lúc**: `state` quay lại `InTransit` (parcel
  vẫn đang di chuyển, chỉ là hướng ngược lại) và `direction` đổi thành
  `Reverse_RTS` (field riêng trên `Parcel` entity, đánh dấu "đang trả về
  người gửi" thay vì giao tới người nhận).
- Chỉ hợp lệ từ `OutForDelivery` — vì BR-04 chỉ kích hoạt sau 3 lần
  `DELIVERY_FAILED` liên tiếp, và parcel chỉ có thể nhận `DELIVERY_FAILED`
  khi đang ở `OutForDelivery`.
- **Quan trọng — đây KHÔNG phải nơi thực thi BR-04 thật sự**: method này
  chỉ re-assert (khẳng định lại) state/direction một khi *đã được quyết
  định* là RTS. Việc **đếm 3 lần** `DELIVERY_FAILED` liên tiếp rồi *quyết
  định* gọi `applyRts()` là trách nhiệm của Courier Service — task
  **6.1**, chưa build. `ParcelStateMachine` ở task 5.3 chỉ cung cấp cái
  "chốt chặn" (guard) cho state transition, không tự đếm gì cả.

## 4. `markDamaged()` — administrative action, không có BR nào backing

```ts
static markDamaged(currentState: ParcelState): ParcelState {
  if (TERMINAL_STATES.has(currentState)) {
    throw new Error(`Cannot mark Damaged from ${currentState}: ...`);
  }
  return ParcelState.DAMAGED;
}
```

- Đã confirm với user (xem `docs/PROGRESS.md`/`TASKS.md` "Decisions"):
  **không có** business rule nào mô tả khi nào một parcel được đánh dấu
  `Damaged`, và **không có** giá trị `DAMAGED` trong
  `TRACKING_EVENT.event_type`'s `CHECK` constraint — nghĩa là trong scope
  hiện tại, đây thuần là một hành động hành chính (ví dụ hub staff thấy
  hàng hư hỏng, tự tay đánh dấu), không gắn với 1 sự kiện scan cụ thể nào.
- Vì không có BR-XX nào backing, method này **không throw
  `BusinessRuleException`** khi hợp lệ — chỉ throw `Error` thường khi gọi
  sai (từ 1 trong 3 terminal state). Cho phép gọi từ **bất kỳ** state
  không-terminal nào (khác với `applyRts` chỉ cho phép từ 1 state duy
  nhất).
- Đây là **gap đã biết, chưa gán task nào** — flagged, không phải bug.

## 5. Terminal states luôn chặn transition tiếp theo

```ts
const TERMINAL_STATES: ReadonlySet<ParcelState> = new Set([
  ParcelState.DELIVERED,
  ParcelState.LOST,
  ParcelState.DAMAGED,
]);
```

`Delivered`/`Lost`/`Damaged` không có bất kỳ dòng nào trong bảng
`TRANSITIONS` dẫn ra khỏi chúng — nên gọi `transition()` từ 1 trong 3
state này với bất kỳ event nào sẽ luôn rơi vào nhánh `throw new Error`
(transition không hợp lệ), đúng như thiết kế "true terminal state."

## 6. Post-review fix — `DELIVERY_FAILED` self-transition (`4282fd1`)

Sau khi wrap task 5.3, code review phát hiện: `DELIVERY_FAILED` là một
`event_type` hợp lệ trong DB, nhưng **không có entry nào** trong bảng
`TRANSITIONS` cho nó — nghĩa là gọi
`transition(OutForDelivery, DELIVERY_FAILED)` sẽ throw lỗi, dù về mặt
nghiệp vụ, 1 lần giao thất bại **không** đổi state của parcel (nó vẫn ở
`OutForDelivery` chờ courier giao lại, cho tới lần thất bại thứ 3 mới
kích hoạt `applyRts`). Nếu để vậy, một consumer sau này (task 5.6 —
fold toàn bộ `TRACKING_EVENT` của 1 parcel để tính state hiện tại) sẽ
phải tự lọc bỏ `DELIVERY_FAILED` trước khi gọi `transition()`, dễ quên.
Fix: thêm **self-transition**:

```ts
[key(ParcelState.OUT_FOR_DELIVERY, TrackingEventType.DELIVERY_FAILED)]:
  ParcelState.OUT_FOR_DELIVERY,
```

— tức "nhận event `DELIVERY_FAILED` khi đang `OutForDelivery` thì vẫn ở
lại `OutForDelivery`," cho phép một event-replay consumer fold qua **mọi**
dòng `TRACKING_EVENT` mà không cần biết trước phải bỏ qua loại nào. 1
test mới, 63/63 tổng số test pass.

### TDD

25 test mới cho 4 method/case ở trên: Misrouted in/out (cả 2 hướng vào
và ra), `markLostSuspected` happy path (4 active state) + reject (3 state
bị chặn), `applyRts` happy path + reject (mọi state khác
`OutForDelivery`), `markDamaged` happy path (mọi state không-terminal) +
reject (3 terminal state), và test terminal-state chặn `transition()`
tiếp theo. Cộng thêm 1 test cho self-transition ở fix post-review. Tất cả
viết và confirm red trước khi implement, đúng TDD flow.

---

## Cách tự chạy test / thử nghiệm (test around)

Giống task 5.2 — đây vẫn là pure module, **chưa** wire vào REST endpoint
hay NATS consumer nào, nên chưa "chạy app lên bấm thử" được. Việc wire
thật (Tracking Service đọc `TRACKING_EVENT`, gọi vào các method này) là
task 5.5/5.6.

### Cách 1 — chạy lại bộ test đã viết

```bash
pnpm test apps/order/src/domain/parcel-state-machine.spec.ts

# hoặc watch mode
pnpm test:watch apps/order/src/domain/parcel-state-machine.spec.ts
```

### Cách 2 — script dùng thử trực tiếp (throwaway script)

```bash
cd /home/dunguyen/Training/nestjs/shipping-system
npx ts-node -r tsconfig-paths/register -e "
import { ParcelStateMachine, TrackingEventType } from './apps/order/src/domain/parcel-state-machine';
import { ParcelState } from './apps/order/src/entities/parcel.enums';

// Misrouted round-trip
console.log(ParcelStateMachine.transition(ParcelState.IN_TRANSIT, TrackingEventType.MISROUTED));
// -> 'Misrouted'
console.log(ParcelStateMachine.transition(ParcelState.MISROUTED, TrackingEventType.HUB_RECEIVE));
// -> 'InHub'

// RTS after 3 failed attempts (Courier Service's job to count - here we just apply it)
console.log(ParcelStateMachine.applyRts(ParcelState.OUT_FOR_DELIVERY));
// -> { state: 'InTransit', direction: 'Reverse_RTS' }

// DELIVERY_FAILED self-transition
console.log(ParcelStateMachine.transition(ParcelState.OUT_FOR_DELIVERY, TrackingEventType.DELIVERY_FAILED));
// -> 'OutForDelivery' (unchanged)

// terminal state blocks further transition
try {
  ParcelStateMachine.transition(ParcelState.DELIVERED, TrackingEventType.PICKUP);
} catch (e) {
  console.log('error:', (e as Error).message);
}
"
```

Lệnh trên chỉ để quan sát trực tiếp, không phải test chính thức.

---

## Vì sao chỉ 1 commit chính (`4d0a23f`)

Khác với task 5.2 (2 commit vì đụng 2 project khác nhau: `libs/dtos` +
`apps/order`), task 5.3 chỉ sửa 1 file (`parcel-state-machine.ts` +
`.spec.ts`), cùng 1 project, đủ nhỏ để không cần tách. Các commit sau
(`f557713`, `0a01e52`) là dọn dẹp comment/README không liên quan logic
của task này; `4282fd1` là fix riêng phát hiện sau review, tách commit
để dễ truy vết lý do sửa.
