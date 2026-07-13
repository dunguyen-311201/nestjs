# Task 5.5 Walkthrough — Tracking Service: append-only event store + consumers

> Tài liệu giải thích tạm thời, viết để review task 5.5. Từ ngữ chuyên
> ngành phổ biến (entity, decorator, abstract, interface, transaction,
> token, enum...) giữ nguyên tiếng Anh, không dịch. File này archive/xoá
> sau khi bạn review xong.

Thứ tự commit: `270bd52` (schema fix `event_id` + ERD/seed regen) →
`dc8bd0e` (`TrackingEvent` entity + repository/order-lookup ports) →
`211a72a` (NATS consumer + `GET /tracking/:trackingId` wiring) → `3eab552`
(backfill walkthrough docs 5.3/5.4, không liên quan code).

Mục tiêu task: đây là **service Tracking đầu tiên có code thật** — trước
task này, `TRACKING_EVENT` chỉ tồn tại trên schema, chưa có entity/consumer
nào ghi vào đó. Task 5.5 dựng: (1) event store append-only, (2) consumer
NATS đầu tiên trong toàn bộ codebase, (3) `GET /tracking/:trackingId`.

---

## Bước 1 — Schema fix: thêm `event_id` (`270bd52`)

**Vấn đề:** `CLAUDE.md`'s idempotency convention có 2 lớp: (1) NATS broker
dedup qua `Nats-Msg-Id` header, (2) **consumer cũng phải tự dedup theo
`event_id`**. Nhưng bảng `TRACKING_EVENT` (trước task này) không có cột
nào để lưu `event_id` — nghĩa là lớp idempotency thứ 2 **không thể cài
được**, đây là lỗ hổng schema thật, cùng loại với `sla_days` ở task 5.4.

**Fix:** thêm vào `db/init-db.sql`'s `shipping_tracking_db.TRACKING_EVENT`:
```sql
event_id UUID NOT NULL UNIQUE
```
`UNIQUE` chính là cơ chế dedup — insert trùng `event_id` sẽ vi phạm
constraint, dùng `ON CONFLICT (event_id) DO NOTHING` để biến đó thành
no-op thay vì lỗi 500. Cập nhật `docs/01-ERD.md`, và sinh `event_id` cho
mỗi scan event trong `generate_seed.py`/`db/seed.sql`.

## Bước 2 — `TrackingEvent` entity + ports (`dc8bd0e`)

**`apps/tracking/src/entities/tracking-event.entity.ts`** — map field-for-
field với schema, kể cả cột `event_id` mới thêm ở Bước 1:

```ts
export enum TrackingEventType {
  PICKUP = 'PICKUP', HUB_RECEIVE = 'HUB_RECEIVE',
  DEPARTED_LINEHAUL = 'DEPARTED_LINEHAUL', ARRIVED_AT_HUB = 'ARRIVED_AT_HUB',
  OUT_FOR_DELIVERY = 'OUT_FOR_DELIVERY', DELIVERY_FAILED = 'DELIVERY_FAILED',
  DELIVERED = 'DELIVERED', MISROUTED = 'MISROUTED', RTS = 'RTS',
}

@Entity({ name: 'tracking_event' })
export class TrackingEvent {
  @PrimaryGeneratedColumn('uuid') id: string;
  @Column({ name: 'event_id', type: 'uuid', unique: true }) eventId: string;
  @Column({ name: 'parcel_id', type: 'uuid' }) parcelId: string;
  @Column({ name: 'hub_id', type: 'uuid', nullable: true }) hubId: string | null;
  @Column({ name: 'courier_id', type: 'uuid', nullable: true }) courierId: string | null;
  @Column({ name: 'linehaul_trip_id', type: 'uuid', nullable: true }) linehaulTripId: string | null;
  @Column({ name: 'event_type', type: 'varchar', length: 50 }) eventType: TrackingEventType;
  @CreateDateColumn({ name: 'created_at' }) createdAt: Date;
}
```

Comment quan trọng ở đầu file: bảng này **append-only** — service không
bao giờ gọi `UPDATE`/`DELETE` lên nó (BR-03), và điều này còn được enforce
ở tầng DB role (ngoài phạm vi code TypeORM).

**`ITrackingEventRepository`/`TrackingEventRepository`** (Ports & Adapters
convention, `docs/lld/00-conventions.md`):

```ts
async appendEvent(data: NewTrackingEvent): Promise<void> {
  await this.repository.createQueryBuilder().insert().values({...}).orIgnore().execute();
}

findTimelineByParcelIds(parcelIds: string[]): Promise<TrackingEvent[]> {
  return this.repository.find({ where: { parcelId: In(parcelIds) }, order: { createdAt: 'ASC' } });
}
```

`.orIgnore()` chính là SQL `ON CONFLICT DO NOTHING` — kết hợp với
`UNIQUE(event_id)` ở Bước 1, một event bị NATS gửi lại (redelivery) sẽ
không tạo dòng thứ 2. `findTimelineByParcelIds` sort `createdAt: 'ASC'`
(cũ nhất trước) vì timeline hiển thị cho user phải theo thứ tự thời gian
thật, không phải thứ tự insert.

**Vấn đề tích hợp khác:** Tracking cần biết "parcel này thuộc order nào,
state hiện tại là gì" để trả về `GET /tracking/:id` — nhưng dữ liệu đó
(`SHIPMENT_ORDER`/`PARCEL`) thuộc về Order Service
(`shipping_order_db`), Tracking không sở hữu. **Giải pháp** (cùng pattern
với task 5.4's `network` connection): thêm 2 entity tối thiểu
(`ShipmentOrder`, `Parcel`, chỉ có field cần dùng) + 1 named TypeORM
connection thứ 2 tên `'order'`, **chỉ đọc**:

```ts
export abstract class IOrderLookupPort {
  abstract findParcelsByShipmentOrderId(shipmentOrderId: string): Promise<OrderParcelSummary[] | null>;
  abstract findShipmentOrderIdByParcelId(parcelId: string): Promise<string | null>;
}
```

`OrderLookupAdapter` implement bằng 2 query đơn giản trên connection
`'order'`. `findParcelsByShipmentOrderId` trả `null` khi order không tồn
tại (→ 404 ở controller); trả mảng rỗng là kết quả hợp lệ (order tồn tại
nhưng chưa có parcel nào resolve).

## Bước 3 — `TrackingEventConsumer` + `GET /tracking/:trackingId` (`211a72a`)

**Consumer NATS đầu tiên trong toàn bộ codebase** — và điểm khác biệt lớn
nhất so với các consumer sau này (task 5.6 trở đi): task này build trực
tiếp trên raw `nats` package, **không** dùng `@nestjs/microservices`
(confirm với user — lý do: chưa cần thêm dependency mới, `nats` client
core đã đủ cho pub/sub đơn giản). Việc này bị **supersede ở task 5.6**
khi Order cần `@nestjs/microservices` cho consumer của nó, và để nhất
quán, Tracking's consumer cũng được refactor sang cùng kỹ thuật.

Subject → `TrackingEventType` mapping tách thành 1 pure function riêng,
test độc lập không cần mock connection:

```ts
const SUBJECT_TO_EVENT_TYPE: Partial<Record<string, TrackingEventType>> = {
  [NATS_SUBJECTS.PARCEL_PICKED_UP]: TrackingEventType.PICKUP,
  [NATS_SUBJECTS.PARCEL_HUB_RECEIVED]: TrackingEventType.HUB_RECEIVE,
  // ... 6 subject khác
};

export function mapSubjectToTrackingEvent(subject, payload): NewTrackingEvent | null {
  const eventType = SUBJECT_TO_EVENT_TYPE[subject];
  if (!eventType || !payload?.event_id || !payload?.parcel_id) return null;
  return { eventId: payload.event_id, parcelId: payload.parcel_id, ... , eventType };
}
```

**2 subject cố ý KHÔNG consume** (confirm với user, ghi rõ trong comment):
- `trip.departed`/`trip.arrived` — không mang `parcel_id` (event ở cấp
  trip, không phải cấp parcel), nên không có dòng `TRACKING_EVENT` nào để
  ghi. HLD's subject-map table vẫn liệt kê Tracking là consumer của cả
  2 — đây là **documentation/schema mismatch đã biết, chưa sửa**, không
  phải bug của task này.
- `DELIVERY_FAILED` — chưa có NATS contract (Courier Service, task 6.1,
  chưa được build).

`TrackingService.getTracking()`:
```ts
async getTracking(shipmentOrderId: string): Promise<TrackingResult> {
  const parcels = await this.orderLookupPort.findParcelsByShipmentOrderId(shipmentOrderId);
  if (!parcels) throw new NotFoundException(...);   // 404

  const [timeline, status] = await Promise.all([
    this.trackingEventRepository.findTimelineByParcelIds(parcels.map(p => p.id)),
    this.statusCachePort.getStatus(shipmentOrderId),
  ]);
  return { shipment_order_id, status, parcels: [...] };
}
```
`status` luôn là `null` ở task này — `IStatusCachePort` chưa được viết,
Redis cache-write là việc của task 5.6. Đây là hành vi tạm thời **đã tài
liệu hóa**, không phải bug.

### TDD

18 test mới: repository (dedup qua `orIgnore`, timeline order),
order-lookup adapter (404 + happy path), 11 case cho pure mapper (bao gồm
subject lạ, thiếu `event_id`/`parcel_id`), service (404 + group theo
parcel), controller (thin, chỉ delegate). Viết và confirm red trước.
85/85 test tổng; `pnpm build`/`pnpm lint` sạch.

---

## Cách tự chạy test / thử nghiệm (test around)

### Cách 1 — unit test
```bash
pnpm test apps/tracking
```

### Cách 2 — chạy app thật + NATS thật (đã tự làm)
```bash
docker compose down -v && docker compose up -d   # reseed sạch
npx nest start tracking
```
```bash
curl http://localhost:<port>/tracking/<shipment_order_id>
```
Kết quả xác nhận: order thật (đã seed) trả về đúng timeline 6 event
(PICKUP → HUB_RECEIVE → DEPARTED_LINEHAUL → ARRIVED_AT_HUB →
OUT_FOR_DELIVERY → DELIVERED); order id không tồn tại → 404 đúng.

Publish 1 event NATS thật 2 lần với **cùng `event_id`**
(`node scripts/publish-event.js parcel.picked_up '{"event_id":"...","parcel_id":"..."}'`
chạy 2 lần) → xác nhận chỉ **1 dòng duy nhất** xuất hiện trong
`TRACKING_EVENT` (query trực tiếp `psql`) — BR-03's dedup hoạt động thật,
không chỉ ở mock.

---

## Vì sao chia làm 3 commit (+ 1 commit docs riêng)

1. `270bd52` — schema fix (`event_id` + ERD + seed): loại thay đổi khác
   hẳn logic code, cần review riêng.
2. `dc8bd0e` — entity + repository + order-lookup: hạ tầng data cần có
   trước khi consumer/service dùng được.
3. `211a72a` — consumer + service + controller: logic nghiệp vụ chính,
   phụ thuộc 2 commit trước.
4. `3eab552` — backfill 2 walkthrough doc còn thiếu của task 5.3/5.4 (việc
   session trước quên làm), tách khỏi vì không liên quan code task 5.5.
