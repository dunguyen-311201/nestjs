# Deep Dive: 3 Pattern Thực Tế Trong Shipping System

Tài liệu này phân tích chi tiết thiết kế, động lực kiến trúc, cạm bẫy thực tế (footguns) và cách triển khai code của **3 Design Patterns cốt lõi** trong hệ thống giao nhận bưu kiện (Shipping System).

---

## ⚡ Pattern 1: Per-Aggregate Serialization (`shipment_orders.status.<id>`)

### 1. Bối cảnh & Vấn đề Race Condition (Lost Update)
Trong hệ thống Logistics, một Đơn hàng (`SHIPMENT_ORDER`) quản lý nhiều Bưu kiện (`PARCEL`). Theo quy tắc **BR-05**, trạng thái của đơn hàng là trạng thái **tiến bộ chậm nhất (least-advanced status)** của tất cả các bưu kiện thuộc đơn đó.

* **Thách thức:** Tại một Hub vận chuyển, 10 bưu kiện của cùng 1 đơn hàng được quét đồng thời tại các băng chuyền khác nhau trong cùng 1 giây.
* **Hệ quả nếu không serialization:** 10 worker cùng đọc DB $\rightarrow$ cùng tính ra trạng thái mới $\rightarrow$ 10 câu lệnh `UPDATE shipment_orders SET status = ...` thực thi đè lên nhau (Race Condition / Lost Update).

---

### 2. Lý do Lựa chọn Kiến trúc (Why NATS JetStream over BullMQ / `@nestjs/microservices`)

1. **Thay thế BullMQ:** BullMQ phụ thuộc vào Redis. Trong hệ thống này, Redis được quy định **chỉ làm Read Cache** (hot projections < 300ms), không làm broker hay job queue để giữ nguyên tắc đơn nhiệm.
2. **Không dùng `@nestjs/microservices` NATS transporter:** Transporter mặc định của NestJS chỉ hỗ trợ **NATS Core** (Pub/Sub vô hướng). NATS Core không hỗ trợ Stream, không có Durable Consumer, không có Manual Ack hay In-Subject Ordering. Vì vậy, hệ thống sử dụng trực tiếp package `nats` (`@nats-io/nats.js`).

---

### 3. Chi tiết Trình tự Triển khai trong Code

#### a. Trigger Event với Payload rỗng (`{}`)
* **File:** [jetstream-status-trigger.adapter.ts](file:///home/dunguyen/Training/nestjs/shipping-system/apps/tracking/src/adapters/jetstream-status-trigger.adapter.ts#L16-L19)
```typescript
await this.js.publish(
  orderStatusSubject(shipmentOrderId), // Format: shipment_orders.status.<id>
  new TextEncoder().encode('{}'),
);
```
* **Triết lý:** Payload cố ý để trống `{}`. Message không mang theo dữ liệu trạng thái (State) mà chỉ là một **"Cú hích" (Trigger signal)** thông báo cho Order Service: *"Đơn hàng ID này vừa có thay đổi bưu kiện, hãy truy vấn DB mới nhất và tính toán lại!"*. Điều này loại bỏ hoàn toàn rủi ro **Stale Data** (message cũ đến muộn ghi đè dữ liệu mới).

#### b. Khởi tạo Stream An toàn (Idempotent Stream Setup)
* **File:** [ensure-shipment-order-status-stream.ts](file:///home/dunguyen/Training/nestjs/shipping-system/apps/order/src/nats/ensure-shipment-order-status-stream.ts#L7-L19)
```typescript
try {
  await jsm.streams.add({
    name: 'SHIPMENT_ORDER_STATUS',
    subjects: ['shipment_orders.status.>'],
  });
} catch (error) {
  if (!(error as Error).message.includes('already in use')) {
    throw error;
  }
}
```
* **Cạm bẫy thực tế (Footgun):** NATS JetStream API không có hàm `createIfNotExists()`. Nếu gọi `.add()` lên Stream đã tồn tại, NATS sẽ throw error `"already in use"`. Việc `catch` và nuốt đúng lỗi này giúp service khởi động an toàn (idempotency) khi scale nhiều replica.

#### c. In-Subject FIFO Ordering & Debounce 300ms
* **File:** [status-projection.consumer.ts](file:///home/dunguyen/Training/nestjs/shipping-system/apps/order/src/status-projection.consumer.ts#L85-L103)
```typescript
scheduleRecompute(shipmentOrderId: string): void {
  const existing = this.timers.get(shipmentOrderId);
  if (existing) {
    clearTimeout(existing); // Reset timer nếu nhận thêm trigger mới trong window 300ms
  }
  const timer = setTimeout(() => {
    this.timers.delete(shipmentOrderId);
    void this.recompute(shipmentOrderId);
  }, this.debounceMs);
  this.timers.set(shipmentOrderId, timer);
}
```
* **Cơ chế:**
  1. **Dynamic Subject:** Mỗi đơn hàng có subject riêng dạng `shipment_orders.status.<order_id>`. NATS JetStream đảm bảo mọi message thuộc cùng một subject sẽ được giao theo đúng thứ tự (In-Subject FIFO Ordering).
  2. **Debouncing:** 100 trigger liên tiếp của 1 đơn hàng trong 1 giây sẽ liên tục reset timer 300ms, giúp Order Service **chỉ thực hiện 1 lần recompute duy nhất** ở cuối window.

#### d. Trade-off: Ack ngay (`message.ack()`) vs Async Recompute
* **File:** [status-projection.consumer.ts](file:///home/dunguyen/Training/nestjs/shipping-system/apps/order/src/status-projection.consumer.ts#L85-L91)
* **Đánh đổi:** Consumer `ack()` ngay lập tức cho NATS Broker rồi mới chạy timer 300ms. Nếu node crash đúng lúc đang đếm timer $\rightarrow$ Mất 1 lần trigger.
* **Lý do chấp nhận:** Trạng thái đơn hàng ở đây là một **Read Model Projection tự hội tụ (Self-Healing / Eventually Consistent)**. Ở lần quét bưu kiện tiếp theo, trigger mới sẽ kích hoạt lại và `recompute()` sẽ tính toán dựa trên trạng thái DB hiện tại, không gây thất thoát dữ liệu tài chính.

---

## 🔄 Pattern 2: Transactional Outbox + Broker-Level Deduplication (Order Creation)

### 1. Vấn đề Dual-Write trong Hệ phân tán
Khi tạo đơn hàng (`POST /orders`), hệ thống phải thực hiện 2 thao tác:
1. Ghi đơn hàng vào Postgres Database.
2. Publish sự kiện `order.created` lên NATS Broker.

Nếu không dùng Outbox Pattern:
* Ghi DB xong nhưng NATS sập $\rightarrow$ Mất sự kiện, các dịch vụ khác không biết đơn hàng đã tạo.
* Ghi NATS trước nhưng DB rollback $\rightarrow$ Bắn "Event ma" cho đơn hàng không tồn tại.

---

### 2. Luồng Xử lý Chuẩn Công Nghiệp (Effectively-Once Processing)

```
┌────────────────────────────────────────────────────────┐
│                   POST /orders Request                 │
└───────────────────────────┬────────────────────────────┘
                            │
                            ▼
┌────────────────────────────────────────────────────────┐
│             TypeORM Atomic DB Transaction              │
│  ├─► INSERT INTO shipment_orders                       │
│  └─► INSERT INTO outbox (status='PENDING', event_id)   │
└───────────────────────────┬────────────────────────────┘
                            │ (Commit Success)
                            ▼
┌────────────────────────────────────────────────────────┐
│       Background OutboxPollerService (500ms)           │
│  ├─► Poll PENDING Rows                                 │
│  ├─► Publish to NATS (Header: Nats-Msg-Id = event_id)  │
│  └─► Mark status = 'PUBLISHED'                         │
└───────────────────────────┬────────────────────────────┘
                            │
                            ▼
┌────────────────────────────────────────────────────────┐
│               NATS JetStream Broker                    │
│  └─► Broker Dedup Window (2 mins) via Nats-Msg-Id      │
└───────────────────────────┬────────────────────────────┘
                            │
                            ▼
┌────────────────────────────────────────────────────────┐
│                 Downstream Consumers                   │
│  └─► DB Level Dedup (ON CONFLICT DO NOTHING)           │
└────────────────────────────────────────────────────────┘
```

#### a. Bước 1: Atomic DB Transaction
Tạo đơn hàng và ghi một bản ghi vào bảng `OUTBOX` trong cùng 1 câu lệnh `BEGIN ... COMMIT`.

#### b. Bước 2: Outbox Poller với Circuit Breaker
* **File:** [outbox-poller.service.ts](file:///home/dunguyen/Training/nestjs/shipping-system/apps/order/src/outbox-poller.service.ts#L46-L77)
* Định kỳ 500ms quét các bản ghi `PENDING`, gửi lên NATS và đánh dấu `PUBLISHED`.
* **Circuit Breaker:** Ngăn Poller liên tục đập lỗi khi NATS sập (nếu lỗi 5 lần liên tiếp $\rightarrow$ dừng poll trong 5s đến 60s).

#### c. Bước 3: Dual-Layer Idempotency (2 Lớp chống trùng)
1. **Lớp 1 - Broker Level (`Nats-Msg-Id`):**
   * **File:** [nats-event-publisher.adapter.ts](file:///home/dunguyen/Training/nestjs/shipping-system/apps/order/src/adapters/nats-event-publisher.adapter.ts#L21-L25)
   ```typescript
   const msgHeaders = headers();
   msgHeaders.set('Nats-Msg-Id', eventId);
   ```
   * NATS JetStream sử dụng `Nats-Msg-Id` header để tự động drop các bản ghi trùng lặp trong khoảng thời gian **Deduplication Window** (mặc định 2 phút).
   * *Chú ý:* Header phải được tạo bằng hàm `headers()` của package `nats`, không dùng plain JavaScript object.
2. **Lớp 2 - Consumer Level (Database Unique Constraint):**
   * Nếu Poller bị delay quá 2 phút (ngoài window của NATS), Consumer vẫn được bảo vệ nhờ lưu `event_id` vào Database/Redis với ràng buộc `UNIQUE` (`ON CONFLICT DO NOTHING`).

> 💡 **Kết luận:** Không có *"Exactly-Once Delivery"* tuyệt đối trên đường truyền mạng. Hệ thống đạt **Effectively-Once Processing** bằng kết hợp **At-Least-Once Delivery** và **Idempotent Consumer**.

---

## 🔕 Pattern 3: Best-Effort Consumer (Notification Service)

### 1. Động lực Thiết kế
Không phải consumer nào cũng cần lưu trữ dữ liệu bền vững (Durable Store), cơ chế Retry hay Outbox Table. Với dịch vụ gửi thông báo (Notification Service):
* **Tính chất:** Side-effect phi nghiệp vụ lõi (gửi Email/SMS).
* **Quy tắc BR-09:** Thất bại trong việc gửi thông báo **không bao giờ được phép chặn, làm rớt hoặc rollback giao dịch của luồng chính**.

---

### 2. Triển khai trong Code
* **File Consumer:** [notification.consumer.ts](file:///home/dunguyen/Training/nestjs/shipping-system/apps/notification/src/notification.consumer.ts)
* **File Service:** [notification.service.ts](file:///home/dunguyen/Training/nestjs/shipping-system/apps/notification/src/notification.service.ts#L49-L61)

```typescript
private async sendNotification(
  referenceId: string,
  subject: string,
  body: string,
): Promise<void> {
  try {
    await this.emailProvider.send(referenceId, subject, body);
  } catch (error) {
    // Log lỗi và BỎ GIAO DỊCH (Drop). Không throw error, không retry loop.
    this.logger.error(
      `Failed to send notification for ${referenceId}: ${(error as Error).message}`,
    );
  }
}
```

---

### 3. Tại sao Retry cho Notification lại CÓ HẠI?
1. **Tránh Spam Khách hàng:** Nếu Mail Provider (Resend/SendGrid) đã nhận email nhưng mạng bị timeout khi phản hồi, việc retry sẽ làm gửi lặp lại 5-10 email trùng cho khách hàng.
2. **Stateless Architecture:** Notification Service **không sở hữu bất kỳ bảng DB nào**, giữ service nhẹ và không tốn tài nguyên queue.
3. **Phân lập Rủi ro:** Đảm bảo sự cố từ các bên thứ 3 (Mail API down) không ảnh hưởng tới luồng xử lý đơn hàng chính.

---

## 📊 So Sánh Tổng Quan 3 Pattern

| Đặc điểm | Pattern 1: Per-Aggregate Serialization | Pattern 2: Outbox + Broker Dedup | Pattern 3: Best-Effort Consumer |
| :--- | :--- | :--- | :--- |
| **Mục đích** | Ngăn Lost Update khi tính Read Projection | Đảm bảo 100% không mất event & chống trùng | Thao tác phụ (Notification/Email) |
| **Lưu trữ** | NATS JetStream + Redis Cache | Postgres Outbox Table + NATS Header | Stateless (Không dùng DB) |
| **Xử lý Lỗi** | Tự hội tụ ở lần quét bưu kiện sau | Poller Retry + Circuit Breaker | Catch & Log lỗi rồi bỏ qua (Drop) |
| **Đảm bảo** | Eventually Consistent Read Model | At-Least-Once + Idempotent Processing | Best-Effort Delivery |
