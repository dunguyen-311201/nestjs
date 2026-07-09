# Task 5.2 Walkthrough — Parcel State Machine + guard conditions

> Tài liệu giải thích tạm thời, viết để review task 5.2. Từ ngữ chuyên
> ngành phổ biến (entity, decorator, abstract, interface, transaction,
> token, enum...) giữ nguyên tiếng Anh, không dịch. File này archive/xoá
> sau khi bạn review xong.

Thứ tự commit: `b37e8a2` (BusinessRuleException) → `2ff2075`
(ParcelStateMachine).

---

## Bước 1 — `BusinessRuleException` (`b37e8a2`)

**Files:** `libs/dtos/src/business-rule.exception.ts` (+ `.spec.ts`), `libs/dtos/src/index.ts`

`docs/lld/00-conventions.md` đã quy định trước: mọi lỗi vi phạm business
rule (Business Rule guard failure) phải trả về HTTP `422` với body
`{ rule: 'BR-XX', message }`, và phải dùng **chung một** exception class
cho toàn bộ services, không tạo class riêng cho từng service. Task 5.2
là task đầu tiên thật sự cần throw một guard-failure error (BR-02), nên
đây là lúc hiện thực class đó.

```ts
export class BusinessRuleException extends UnprocessableEntityException {
  constructor(
    public readonly rule: string,
    message: string,
  ) {
    super({ rule, message });
  }
}
```

- `extends UnprocessableEntityException` — đây là exception class có sẵn
  của NestJS, tự động map sang HTTP status `422`. Kế thừa (extend) từ nó
  nghĩa là mình không phải tự viết logic set status code, NestJS đã lo
  sẵn phần đó.
- `super({ rule, message })` — `UnprocessableEntityException`'s
  constructor nhận một tham số gọi là "response body" (object sẽ được
  serialize thành JSON trả về client). Truyền `{ rule, message }` vào đó
  nghĩa là bất cứ ai gọi `error.getResponse()` sẽ nhận đúng shape JSON mà
  `docs/lld/00-conventions.md` yêu cầu — không cần viết thêm exception
  filter riêng chỉ để format lại response.
- `public readonly rule: string` — cú pháp "parameter property" của
  TypeScript: khai báo `public readonly` ngay trong constructor tự động
  tạo một property `this.rule` gán từ tham số, không cần viết thêm dòng
  `this.rule = rule` riêng.

**Tại sao đặt trong `libs/dtos` chứ không phải `apps/order`:** vì đây là
class dùng chung, không riêng cho Order Service. Việc chạm vào một
project khác ngoài phạm vi ban đầu (`apps/order`) đã được hỏi và bạn xác
nhận trước khi code (per `CLAUDE.md`'s decision-authority table — touching
a project beyond what's asked needs confirmation).

TDD ở bước này: 3 test case — instance là `UnprocessableEntityException`,
response body đúng `{ rule, message }`, và `rule`/`message` đọc được như
property bình thường.

## Bước 2 — `ParcelStateMachine` (`2ff2075`)

**Files:** `apps/order/src/domain/parcel-state-machine.ts` (+ `.spec.ts`)

Đây là phần chính của task: một state machine (máy trạng thái) thuần
(pure — không đụng DB, không đụng NATS, không có side effect nào) để
quyết định: với một `Parcel` đang ở state X, khi có event Y xảy ra
(ví dụ courier scan `HUB_RECEIVE`), thì parcel đó được phép chuyển sang
state nào — hoặc bị chặn lại (guard).

### Enum `TrackingEventType`

```ts
export enum TrackingEventType {
  PICKUP = 'PICKUP',
  HUB_RECEIVE = 'HUB_RECEIVE',
  DEPARTED_LINEHAUL = 'DEPARTED_LINEHAUL',
  ARRIVED_AT_HUB = 'ARRIVED_AT_HUB',
  OUT_FOR_DELIVERY = 'OUT_FOR_DELIVERY',
  DELIVERY_FAILED = 'DELIVERY_FAILED',
  DELIVERED = 'DELIVERED',
  MISROUTED = 'MISROUTED',
  RTS = 'RTS',
}
```

9 giá trị này khớp chính xác với ràng buộc `CHECK (event_type IN (...))`
trên bảng `TRACKING_EVENT` trong `db/init-db.sql` — mỗi dòng scan
(pickup, nhập kho, xuất kho, giao hàng...) tương lai sẽ có một
`event_type` thuộc 1 trong 9 giá trị này. Task 5.2 chỉ **dùng** enum này
để làm key tra bảng transition, chưa thật sự có consumer nào đọc
`TRACKING_EVENT` để gọi vào state machine (đó là việc của task 5.5).

### Bảng lookup transition

```ts
type TransitionKey = `${ParcelState}:${TrackingEventType}`;

const HAPPY_PATH_TRANSITIONS: Partial<Record<TransitionKey, ParcelState>> = {
  [key(ParcelState.CREATED, TrackingEventType.PICKUP)]: ParcelState.IN_TRANSIT,
  [key(ParcelState.IN_TRANSIT, TrackingEventType.HUB_RECEIVE)]: ParcelState.IN_HUB,
  // ...
};
```

- `` `${ParcelState}:${TrackingEventType}` `` là một **template literal
  type** của TypeScript — nó sinh ra kiểu string dạng `"Created:PICKUP"`,
  `"InHub:OUT_FOR_DELIVERY"`... TypeScript sẽ tự check lúc compile rằng
  key mình dùng đúng định dạng `<ParcelState>:<TrackingEventType>`, gõ
  sai một trong hai enum sẽ báo lỗi ngay, không đợi tới runtime.
- `Partial<Record<TransitionKey, ParcelState>>` — `Record<K, V>` là kiểu
  "object với key kiểu K, value kiểu V" có sẵn của TypeScript.
  `Partial<...>` nghĩa là không bắt buộc phải có đủ **mọi** cặp
  `(state, event)` có thể — vì rõ ràng không phải cặp nào cũng hợp lệ
  (ví dụ `Delivered:PICKUP` không có nghĩa gì), nên object này chỉ liệt
  kê những cặp *thật sự* hợp lệ (happy path), các cặp còn lại đơn giản là
  "không tồn tại trong object" (`undefined`).
- Cách tra: `HAPPY_PATH_TRANSITIONS[key(currentState, event)]` — nếu cặp
  đó có trong bảng, trả về state tiếp theo; nếu không, trả về
  `undefined`, tức là transition này không hợp lệ.

### Guard BR-02

```ts
static transition(currentState: ParcelState, event: TrackingEventType): ParcelState {
  const nextState = HAPPY_PATH_TRANSITIONS[key(currentState, event)];
  if (!nextState) {
    if (event === TrackingEventType.OUT_FOR_DELIVERY) {
      throw new BusinessRuleException('BR-02', `...`);
    }
    throw new Error(`No valid transition from ${currentState} on event ${event}`);
  }
  return nextState;
}
```

- Nếu tra bảng ra `undefined` (transition không hợp lệ), có 2 nhánh:
  1. Nếu event đang cố thực hiện là `OUT_FOR_DELIVERY` (tức parcel đang
     cố chuyển sang "đang giao hàng" mà chưa ở state `InHub`) → đây
     **chính là** kịch bản mà **BR-02** mô tả ("Out_for_Delivery chỉ được
     phép sau khi đã đến destination hub") → throw
     `BusinessRuleException('BR-02', ...)`.
  2. Bất kỳ transition không hợp lệ nào khác (ví dụ đã `Delivered` rồi mà
     lại nhận thêm event `PICKUP`) → đây là một trường hợp *chưa có BR
     nào tài liệu hoá*, nên throw một `Error` thường, **không** gắn nhãn
     `BR-02` cho nó — gắn nhầm rule ID sẽ gây hiểu lầm khi audit BR
     coverage sau này (đây cũng chính là lỗi mình tự phát hiện và sửa
     trước khi commit, xem lại trong `TASKS.md`/`docs/PROGRESS.md`).

### Vì sao chưa xử lý Misrouted/Lost/Damaged/RTS ở đây

BR-02 đầy đủ có 2 vế: "(1) `Out_for_Delivery` chỉ được phép sau khi đến
đúng destination hub" và "(2) nếu scan nhầm hub thì set state =
`Misrouted` và kích hoạt corrective re-route." Task 5.2 chỉ làm vế (1).
Lý do: để biết một hub scan có phải "nhầm hub" hay không, cần so sánh
hub vừa scan với **destination hub thật sự** của parcel đó — nhưng
`Parcel` entity (thuộc Order Service) không hề lưu thông tin hub, nó chỉ
có `route_id` là một tham chiếu chéo service (logical FK) sang Hub
Service. Nói cách khác, việc xác định "đúng/sai hub" cần dữ liệu từ một
service khác — vượt ra ngoài phạm vi của một module thuần
(pure module) như `ParcelStateMachine`. Việc đó, cùng với logic RTS sau 3
lần giao thất bại (BR-04) và các state cuối (`Lost`, `Damaged`), được để
lại cho task **5.3**.

### TDD

`parcel-state-machine.spec.ts` dùng `it.each(...)` — một tiện ích của
Jest để chạy cùng một test body với nhiều bộ dữ liệu khác nhau (tránh
copy-paste 6 lần cho 6 transition, hay 4 lần cho 4 state bị chặn). Test
bao gồm: 6 happy-path transition, 4 trường hợp guard BR-02 (chặn
`OUT_FOR_DELIVERY` từ 4 state khác `InHub`), và 1 trường hợp transition
không hợp lệ chung chung (kiểm tra nó **không** bị gắn `BR-02`).

---

## Vì sao chia làm 2 commit

`b37e8a2` (BusinessRuleException, thuộc `libs/dtos`) đứng trước
`2ff2075` (ParcelStateMachine, thuộc `apps/order`) vì cái sau **phụ
thuộc** vào cái trước (import `BusinessRuleException` từ `@app/dtos`).
Tách riêng giúp review rõ: "shared exception class có đúng shape/behaviour
không?" tách biệt với "state machine logic có đúng không?".
