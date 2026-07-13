# Task 5.6 Walkthrough — Status projection (read model, <300ms) + Transactional Outbox

> Tài liệu giải thích tạm thời, viết để review task 5.6. Từ ngữ chuyên
> ngành phổ biến (entity, decorator, abstract, interface, transaction,
> token, enum...) giữ nguyên tiếng Anh, không dịch. File này archive/xoá
> sau khi bạn review xong.

Thứ tự commit: `265ec0a` (schema/docs trước khi code) → `fc29f4f`
(quality-gate fix, không liên quan logic task) → `c24f040` (Transactional
Outbox) → `03c8d07` (`ParcelEventConsumer` + `StatusProjectionConsumer`) →
`9101890` (refactor Tracking's consumer) → `0f238b7` (`GET /tracking/:id`
đọc Redis cache thật) → `2106cea` (script test thủ công, không liên quan
logic).

Mục tiêu task: đây là task **khép kín Diagram 8** (`docs/lld/order-
service.md`) — vòng lặp scan event → cập nhật `PARCEL.state` → trigger
recompute → `SHIPMENT_ORDER.status` (BR-05) → cache Redis → API đọc ra
cache. Trước task này, `order.created` (khai báo từ task 5.1) **chưa bao
giờ thực sự được publish** — chỉ tồn tại trên giấy.

---

## Bước 1 — Docs/schema viết TRƯỚC khi code (`265ec0a`)

Confirm với user: viết tài liệu trước khi code, không phải ngược lại.

- **`OUTBOX` table** thêm vào `db/init-db.sql`/`docs/01-ERD.md` —
  entity chưa hề tồn tại, dù Transactional Outbox pattern đã được nhắc
  trong `CLAUDE.md` từ đầu dự án.
- **BR-05 mapping table** thêm vào `docs/04-business-rules.md`: BR-05 chỉ
  nói nguyên tắc 1 dòng ("status = trạng thái ít tiến triển nhất trong
  các parcel"), không liệt kê **map cụ thể** từ tổ hợp `ParcelState[]` →
  `ShipmentOrderStatus`. Bảng này liệt kê đủ 6 case (all active → Active,
  all delivered → Complete, all lost → Lost, all damaged → Damaged, mix
  terminal → Partially_Delivered, rỗng → lỗi).
- **Redis key convention** `order:status:{id}` ghi vào
  `docs/lld/order-service.md`.
- **Fix bug nhỏ:** `orderStatusSubject()` trong
  `libs/contracts/src/subjects.ts` đang sinh `orders.status.<id>`, sai với
  ADR-001/Diagram 8 (`shipment_orders.status.<id>`) — sửa lại cho khớp.

## Bước 2 — Quality-gate gap (`fc29f4f`, không phải logic nghiệp vụ)

**Phát hiện tình cờ khi build:** `pnpm build` chạy `nest build` (không
tham số) — trong monorepo nhiều app, lệnh này **chỉ build/type-check app
mặc định** (`api-gateway`). Mọi app khác (`order`, `tracking`,
`courier`...) **chưa từng được type-check thật** kể từ khi scaffold ở
Phase 4. Build từng app riêng lẻ phát hiện **2 lỗi type thật**:
`IOrderRepository.updateShipmentOrderStatus`'s tham số `status` khai báo
`string` lỏng lẻo thay vì đúng enum `ShipmentOrderStatus` của entity, và 1
lỗi type-import decorator-metadata trong consumer của Tracking (đã
refactor ở Bước 5). Sửa cả 2, đổi script `build` thành `nest build --all`.

## Bước 3 — Transactional Outbox (`c24f040`)

**`Outbox` entity:**
```ts
export enum OutboxStatus { PENDING = 'PENDING', PUBLISHED = 'PUBLISHED' }

@Entity({ name: 'outbox' })
export class Outbox {
  @PrimaryGeneratedColumn('uuid') id: string;
  @Column({ name: 'event_id', type: 'uuid', unique: true }) eventId: string;
  @Column({ name: 'event_type', type: 'varchar', length: 100 }) eventType: string;
  @Column({ name: 'payload', type: 'jsonb' }) payload: Record<string, unknown>;
  @Column({ name: 'status', type: 'varchar', length: 20, default: OutboxStatus.PENDING }) status: OutboxStatus;
  @CreateDateColumn({ name: 'created_at' }) createdAt: Date;
  @Column({ name: 'published_at', type: 'timestamp', nullable: true }) publishedAt: Date | null;
}
```

**`IOutboxRepository`** chỉ 2 method cần dùng (không thêm method speculative):
```ts
abstract findPendingBatch(limit: number): Promise<Outbox[]>;
abstract markPublished(id: string): Promise<void>;
```

**Điểm mấu chốt của pattern Outbox:** `OrderRepository.createOrder` giờ
insert dòng `OUTBOX` (event `order.created`) **trong cùng transaction**
với `SHIPMENT_ORDER`/`PARCEL` — nếu transaction rollback, outbox row cũng
rollback theo, đảm bảo không có chuyện DB ghi thành công nhưng event
"biến mất" (hoặc ngược lại, event publish nhưng DB rollback).

**`OutboxPollerService`** — polling interval, không dùng thêm scheduler
package nào:
```ts
onModuleInit(): void {
  this.interval = setInterval(() => void this.pollOnce(), POLL_INTERVAL_MS);
}

async pollOnce(): Promise<void> {
  if (this.polling) return;              // chặn 2 tick chạy song song
  this.polling = true;
  try {
    const rows = await this.outboxRepository.findPendingBatch(BATCH_SIZE);
    for (const row of rows) {
      try {
        await this.eventPublisher.publish(row.eventType, row.eventId, row.payload);
        await this.outboxRepository.markPublished(row.id);
      } catch (error) {
        this.logger.error(...);          // 1 row publish fail không chặn các row khác
      }
    }
  } finally { this.polling = false; }
}
```

**`NatsEventPublisher`** — bug thật, **chỉ lộ ra khi chạy thật**, không
lỗi ở mock/type-check:
```ts
async publish(subject, eventId, payload): Promise<void> {
  const msgHeaders = headers();               // phải dùng headers() thật từ package 'nats'
  msgHeaders.set('Nats-Msg-Id', eventId);
  const record = new NatsRecordBuilder(payload).setHeaders(msgHeaders).build();
  await firstValueFrom(this.client.emit(subject, record));
}
```
Ban đầu code truyền 1 plain object `{ 'Nats-Msg-Id': eventId }` thay vì
gọi `headers()` — TypeScript structural typing **cho qua** (plain object
khớp interface `MsgHdrs` về mặt shape), mock test cũng pass vì không thật
sự serialize. Chỉ khi publish thật lên NATS mới lỗi `hdrs.encode is not a
function`, vì `NatsRecordSerializer` gọi `.encode()` — method chỉ có trên
`MsgHdrs` thật (built qua `headers()`), không có trên plain object.

## Bước 4 — 2 consumer mới trong Order (`03c8d07`)

**`ParcelEventConsumer`** — Order tự nghe lại **cùng 8 subject**
`parcel.*` mà Tracking cũng nghe (để ghi `TRACKING_EVENT`), nhưng mục
đích khác: cập nhật `PARCEL.state` của chính Order qua
`ParcelStateMachine` (đã build từ task 5.2/5.3 nhưng **chưa từng được
wire vào đâu** cho tới task này):

```ts
private async handle(subject: string, payload: ParcelLifecyclePayload): Promise<void> {
  const eventType = mapSubjectToEventType(subject);
  if (!eventType || !payload?.parcel_id) return;

  const parcel = await this.orderRepository.findParcelById(payload.parcel_id);
  if (!parcel) { this.logger.warn(...); return; }

  try {
    const nextState = ParcelStateMachine.transition(parcel.state, eventType);
    await this.orderRepository.updateParcelState(parcel.id, nextState);
  } catch (error) {
    // NATS consumer không có response HTTP để trả 422 - log rồi drop.
    this.logger.warn(`Dropped ${subject} for parcel ${parcel.id}: ${error.message}`);
  }
}
```
Điểm khác biệt lớn với REST endpoint: `BusinessRuleException` (BR-02) hay
transition không hợp lệ **không throw ra ngoài** — chỉ log rồi bỏ qua,
vì không có ai để trả `422` cho.

**`StatusProjectionConsumer`** — implement pure function BR-05
(`computeOrderStatus`, xem `apps/order/src/domain/status-projection.ts`)
và **debounce** (đây chính là nửa "event-batching" của BR-07 — nửa còn
lại, JetStream, để dành task 5.7):

```ts
scheduleRecompute(shipmentOrderId: string): void {
  const existing = this.timers.get(shipmentOrderId);
  if (existing) clearTimeout(existing);
  const timer = setTimeout(() => {
    this.timers.delete(shipmentOrderId);
    void this.recompute(shipmentOrderId);
  }, this.debounceMs);
  this.timers.set(shipmentOrderId, timer);
}

async recompute(shipmentOrderId: string): Promise<void> {
  const parcelStates = await this.orderRepository.findParcelStatesByShipmentOrderId(shipmentOrderId);
  if (!parcelStates?.length) { this.logger.warn(...); return; }
  const status = computeOrderStatus(parcelStates);
  await this.orderRepository.updateShipmentOrderStatus(shipmentOrderId, status);
  await this.redis.set(`order:status:${shipmentOrderId}`, status);
}
```
`scheduleRecompute` gọi nhiều lần liên tiếp cho **cùng 1 order** (ví dụ 1
hub xử lý hàng trăm parcel của cùng order trong vài giây) chỉ tạo ra
**1 lần recompute duy nhất** — mỗi lần gọi mới sẽ `clearTimeout` timer cũ
và đặt lại timer mới (~300ms). Khác order thì timer độc lập, chạy song
song bình thường — không debounce chéo giữa các order.

`apps/order/src/main.ts` chuyển thành **hybrid HTTP + NATS app**
(`NestFactory.create` + `connectMicroservice`) để 2 consumer trên hoạt
động cùng lúc với REST endpoint.

## Bước 5 — Tracking refactor sang `@nestjs/microservices` (`9101890`)

Confirm với user: task 5.5 xây consumer trên raw `nats` client (lý do khi
đó: không cần thêm dependency mới). Nhưng task 5.6 cần
`@nestjs/microservices` cho Order — **để nhất quán kỹ thuật NATS giữa 2
service**, Tracking's consumer (từ task 5.5) cũng được refactor sang cùng
kỹ thuật. Logic mapping subject → event (`map-subject-to-tracking-
event.ts`) **giữ nguyên**, chỉ đổi phần connection/subscription wiring.

Thêm mới ở bước này: sau khi append `TRACKING_EVENT`, Tracking publish
1 recompute-trigger (`orderStatusSubject(shipmentOrderId)`) — phần
"producer" của Diagram 8 mà task 5.5 cố ý chưa làm.

## Bước 6 — `GET /tracking/:id` đọc cache thật (`0f238b7`)

```ts
export class RedisStatusCacheAdapter implements IStatusCachePort {
  async getStatus(shipmentOrderId: string): Promise<string | null> {
    return this.redis.get(`order:status:${shipmentOrderId}`);
  }
}
```
Cache miss vẫn trả `null` — là trạng thái transient hợp lệ (order vừa
tạo, projection consumer chưa kịp recompute), không phải lỗi.

### TDD

Tất cả viết và confirm red trước khi code: BR-05 mapping (6 case), outbox
insert/repository/poller (dedup-safe, tiếp tục dù 1 publish fail, không
double-poll), event-publisher (set header đúng cách), parcel-event
consumer (update state, parcel lạ, BR-02 drop, payload hỏng), status-
projection consumer (debounce gộp burst, độc lập theo order, ghi cả
Postgres + Redis, cache-miss no-op), Tracking's lookup method mới +
publish call, Tracking's consumer refactor (đủ 8 subject + case lỗi),
status-cache adapter, `TrackingService`'s cache-read. 132/132 test tổng;
`pnpm build`/`pnpm lint` sạch lần đầu tiên cho **toàn bộ** app/lib (nhờ
fix ở Bước 2).

---

## Cách tự chạy test / thử nghiệm (test around)

### Cách 1 — unit test
```bash
pnpm test apps/order apps/tracking
```

### Cách 2 — chạy cả 2 app thật + NATS/Redis/Postgres thật (đã tự làm)
```bash
docker compose down -v && docker compose up -d
npx nest start order      # terminal 1
npx nest start tracking   # terminal 2
```
```bash
curl -X POST http://localhost:<order-port>/orders -H 'Idempotency-Key: <uuid>' -d '{...}'
# → xác nhận có dòng OUTBOX mới (status PENDING), rồi tự chuyển PUBLISHED
#   sau vài trăm ms (poller) - query trực tiếp psql, không chỉ tin response.

node scripts/publish-event.js parcel.picked_up '{"event_id":"...","parcel_id":"<real-parcel-id>","courier_id":"..."}'
```
Kết quả xác nhận (query DB/Redis trực tiếp, không chỉ HTTP response):
`PARCEL.state` chuyển `Created` → `InTransit` (Order's `ParcelEventConsumer`),
1 dòng `TRACKING_EVENT` mới (Tracking's consumer), `SHIPMENT_ORDER.status`
tính lại thành `Active` cả trong Postgres và Redis, và
`GET /tracking/:id` trả đúng status `Active` không còn `null` nữa — cả
vòng Diagram 8 chạy đúng, xuyên suốt 2 service thật, không chỉ mock từng
mảnh riêng lẻ.

---

## Vì sao chia làm nhiều commit

1. `265ec0a` — docs/schema viết **trước** code (yêu cầu riêng của user
   cho task này): review được ý định thiết kế độc lập với cách implement.
2. `fc29f4f` — fix quality-gate (`nest build --all`) + 2 lỗi type nó phát
   hiện ra: không liên quan logic nghiệp vụ của task, tách riêng để không
   làm nhiễu commit chính.
3. `c24f040` — Transactional Outbox: 1 khối hạ tầng độc lập, Order publish
   `order.created` thật lần đầu tiên.
4. `03c8d07` — 2 consumer mới của Order: phần lõi nghiệp vụ chính của
   task (BR-05 + wiring `ParcelStateMachine`).
5. `9101890` — refactor Tracking sang `@nestjs/microservices`: thay đổi kỹ
   thuật (không đổi logic), tách riêng để review dễ so sánh trước/sau.
6. `0f238b7` — `GET /tracking/:id` đọc cache thật: thay đổi nhỏ, phụ
   thuộc cả 2 commit trước (cần cả Redis-write từ Order và consumer đã
   refactor ở Tracking).
7. `2106cea` — thêm script test thủ công + sửa ESLint ignore: tooling, không
   phải logic nghiệp vụ.
