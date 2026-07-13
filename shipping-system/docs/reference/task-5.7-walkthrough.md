# Task 5.7 Walkthrough — Per-aggregate serialization: NATS JetStream per-order subject + event-batching

> Tài liệu giải thích tạm thời, viết để review task 5.7. Từ ngữ chuyên
> ngành phổ biến (entity, decorator, abstract, interface, transaction,
> token, enum...) giữ nguyên tiếng Anh, không dịch. File này archive/xoá
> sau khi bạn review xong.

Thứ tự commit: `cdc1b0d` (Tracking's publish side sang JetStream thật) →
`9c0cdca` (Order's consume side sang JetStream consumer thật).

Mục tiêu task: task 5.6 đã có `shipment_orders.status.<id>` trigger +
debounce (nửa "event-batching" của BR-07), nhưng subject này vẫn chạy
trên `@nestjs/microservices`' NATS-core transport, **không phải
JetStream thật** — ADR-005 đã ghi rõ transporter built-in của
`@nestjs/microservices` **không nói được JetStream** ("to use JetStream...
we must use the official `nats` npm package directly"). Đây là 1 gap đã
được flag từ session trước (`docs/PROGRESS.md`'s Notes: "not yet built"),
không phải feature mới phát sinh. Task 5.7 đóng gap này: chuyển đúng 1
subject (`shipment_orders.status.<id>`, theo ADR-001) sang JetStream thật
— stream persistent + durable consumer + explicit ack. Debounce logic
(task 5.6) **giữ nguyên hoàn toàn**, không đụng vào.

**Vì sao chỉ đúng 1 subject, không chuyển hết:** ADR-001 chỉ định nghĩa
per-aggregate serialization cho đúng subject này (per-order status
projection) — các subject `parcel.*` (parcel lifecycle) và `order.created`
(outbox) không cần ordering per-aggregate kiểu này, tiếp tục chạy
NATS-core bình thường qua `@nestjs/microservices`.

---

## Bước 1 — Tracking: publish trigger qua JetStream thật (`cdc1b0d`)

**Trước:** `TrackingEventConsumer.handle()` gọi
`this.client.emit(orderStatusSubject(shipmentOrderId), {})` — `client` là
`ClientProxy` của `@nestjs/microservices`, publish theo NATS-core (fire-
and-forget, không persist).

**Sau:** thêm 1 port mới, tách biệt hẳn khỏi `ClientProxy`:
```ts
export abstract class IStatusTriggerPublisher {
  abstract publish(shipmentOrderId: string): Promise<void>;
}
```

**`JetStreamStatusTriggerPublisher`** — dùng trực tiếp `nats` package's
`JetStreamClient` (không qua `@nestjs/microservices`, vì package đó không
hỗ trợ JetStream):
```ts
@Injectable()
export class JetStreamStatusTriggerPublisher implements IStatusTriggerPublisher {
  constructor(@Inject(JETSTREAM_CLIENT) private readonly js: JetStreamClient) {}

  async publish(shipmentOrderId: string): Promise<void> {
    await this.js.publish(
      orderStatusSubject(shipmentOrderId),
      new TextEncoder().encode('{}'),
    );
  }
}
```

**`JETSTREAM_CLIENT` provider** — 1 connection `nats` riêng, độc lập với
connection `ClientsModule`/`ClientProxy` sẵn có (2 connection socket khác
nhau tới cùng NATS server, vì `ClientProxy` không expose API JetStream):
```ts
export async function createJetStreamClient() {
  const nc = await connect({ servers: [process.env.NATS_URL ?? 'nats://localhost:4222'] });
  return nc.jetstream();
}
```
Bootstrap code này (mở socket thật) **không unit-test** — cùng convention
với các bootstrap NATS khác trong codebase (chỉ live-verify).

`TrackingEventConsumer` đổi tham số constructor từ `client: ClientProxy`
sang `statusTriggerPublisher: IStatusTriggerPublisher`, gọi
`await this.statusTriggerPublisher.publish(shipmentOrderId)` thay vì
`emit`. Wiring trong `tracking.module.ts`:
```ts
{ provide: IStatusTriggerPublisher, useClass: JetStreamStatusTriggerPublisher },
{ provide: JETSTREAM_CLIENT, useFactory: createJetStreamClient },
```

## Bước 2 — Order: consume trigger qua JetStream ordered consumer thật (`9c0cdca`)

**Trước:** `StatusProjectionConsumer` là 1 `@Controller()` của
`@nestjs/microservices`, dùng decorator `@EventPattern` để subscribe
NATS-core.

**Sau:** không còn là `@nestjs/microservices` controller nữa — trở thành
1 service thường, tự quản lý JetStream connection qua `OnModuleInit`/
`OnModuleDestroy`:

```ts
async onModuleInit(): Promise<void> {
  const { connect } = await import('nats');
  this.connection = await connect({ servers: [...] });
  const jsm = await this.connection.jetstreamManager();
  await ensureShipmentOrderStatusStream(jsm);            // idempotent bootstrap

  const js = this.connection.jetstream();
  const consumer = await js.consumers.get(
    'SHIPMENT_ORDER_STATUS',
    await this.ensureConsumer(jsm),
  );
  void this.consumeMessages(consumer);                    // chạy nền, không await
}

async onModuleDestroy(): Promise<void> {
  await this.connection?.close();                          // đóng connection sạch sẽ khi shutdown
}
```

**Idempotent stream bootstrap** — JetStream không có API "create if not
exists", nên phải tự bắt lỗi:
```ts
export async function ensureShipmentOrderStatusStream(jsm: JetStreamManager): Promise<void> {
  try {
    await jsm.streams.add({ name: 'SHIPMENT_ORDER_STATUS', subjects: ['shipment_orders.status.>'] });
  } catch (error) {
    if (!(error as Error).message.includes('already in use')) throw error;
  }
}
```
Cùng pattern áp dụng cho durable consumer (`ensureConsumer`, method riêng
private trong class, bắt lỗi "already in use" tương tự) — restart app
nhiều lần không tạo trùng stream/consumer, không throw.

**Xử lý message:** logic debounce/recompute (`scheduleRecompute`/
`recompute`) từ task 5.6 **giữ nguyên 100%**, chỉ thêm 1 method mới nối
JetStream message vào nó:
```ts
handleMessage(message: JsMsg): void {
  const shipmentOrderId = message.subject.split('.').pop();
  if (shipmentOrderId) this.scheduleRecompute(shipmentOrderId);
  message.ack();                          // explicit ack (AckPolicy.Explicit)
}
```
Ack ngay sau khi **schedule** (không đợi `recompute` chạy xong) — vì
trigger này chỉ là tín hiệu "có gì đó thay đổi, tính lại đi", không mang
dữ liệu quan trọng phải giữ lại nếu process crash: nếu app crash trước
khi debounce timer chạy, JetStream sẽ redeliver message (do chưa ack),
và `recompute()` vốn **idempotent** (đọc lại state hiện tại từ DB, không
dựa vào nội dung message) nên redeliver có chạy lại cũng an toàn.

`order.module.ts`: `StatusProjectionConsumer` chuyển từ mảng
`controllers` (dành cho `@nestjs/microservices` pattern handler) sang
`providers` (giờ chỉ là 1 service DI thường, tự quản lý lifecycle riêng).

### TDD

3 nhóm test mới, viết và confirm red trước khi code:
1. `ensure-shipment-order-status-stream.spec.ts` — tạo mới khi chưa có,
   swallow lỗi "already in use", rethrow lỗi khác.
2. `jetstream-status-trigger.adapter.spec.ts` — publish đúng subject +
   payload `{}` qua JetStream client mock.
3. `status-projection.consumer.spec.ts` (thêm 2 case mới, giữ nguyên các
   case debounce cũ từ 5.6) — `handleMessage` parse đúng
   `shipment_order_id` từ subject, gọi `scheduleRecompute`, rồi `ack()`;
   và case subject không có id ở cuối vẫn `ack()` nhưng không schedule.

137/137 test tổng; `pnpm build`/`pnpm lint` sạch.

**Không cần test BR-guard/422:** BR-07 là cơ chế transport/concurrency,
không phải business rule có REST error envelope — không có
`BusinessRuleException` nào áp dụng ở đây, đã xác nhận không phải lỗ hổng
coverage.

---

## Cách tự chạy test / thử nghiệm (test around)

### Cách 1 — unit test
```bash
pnpm test apps/order/src/status-projection.consumer.spec.ts \
          apps/order/src/nats/ensure-shipment-order-status-stream.spec.ts \
          apps/tracking/src/adapters/jetstream-status-trigger.adapter.spec.ts
```

### Cách 2 — chạy app thật + kiểm tra JetStream thật qua monitoring API (đã tự làm)
```bash
docker compose ps   # NATS đã chạy sẵn với "-js" (JetStream server-side bật từ trước, không cần đổi)
npx nest start order      # terminal 1
npx nest start tracking   # terminal 2
```
```bash
curl -s "localhost:8222/jsz?streams=true&consumers=true" | python3 -m json.tool
```
Xác nhận: `SHIPMENT_ORDER_STATUS` stream + durable consumer
`order-status-projection` **có thật**, được tạo lúc app khởi động (không
phải giả lập).

```bash
node scripts/publish-event.js parcel.picked_up '{"event_id":"...","parcel_id":"<real-Created-parcel-id>","courier_id":"..."}'
sleep 1.5
curl -s "localhost:8222/jsz?streams=true&consumers=true" | python3 -c "..."   # kiểm tra ack_floor bắt kịp stream_seq
```
Kết quả xác nhận: stream nhận đúng 1 message, consumer ack đúng
(`ack_floor.stream_seq` bắt kịp `stream_seq` mới nhất) — **không chỉ tin
response HTTP**, mà kiểm tra thẳng qua NATS monitoring API. Query
`psql`/`redis-cli` trực tiếp xác nhận `PARCEL.state` → `InTransit`,
`SHIPMENT_ORDER.status` → `Active` (Postgres + Redis) — cùng hiệu ứng
Diagram 8 như task 5.6, giờ chạy qua JetStream thật thay vì NATS-core.
Tắt cả 2 app (`kill`) xác nhận thoát sạch, không treo tiến trình
(`onModuleDestroy` đóng connection JetStream đúng cách).

---

## Vì sao chia làm 2 commit

1. `cdc1b0d` — phía publish (Tracking): tự đứng độc lập được, review xong
   phần "publisher publish đúng chưa" trước khi nhìn phần consumer.
2. `9c0cdca` — phía consume (Order) + wiring `order.module.ts`: phụ thuộc
   logic publish ở commit 1 để test end-to-end có ý nghĩa, nhưng bản thân
   thay đổi (consumer/stream/ack) là 1 khối logic riêng, tách để review
   không bị lẫn 2 phía publish/consume vào 1 diff.

Không tạo ADR mới cho quyết định "dùng raw `nats` package thay vì
`@nestjs/microservices`" — quyết định này **đã được ADR-005 tài liệu hóa
sẵn** như một hạn chế đã biết của thư viện, task này chỉ là hiện thực hóa
điều ADR-005 đã dự đoán, không phải 1 pattern/tradeoff mới cần ADR riêng.
