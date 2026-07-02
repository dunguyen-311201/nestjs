# Phân Tích Kiến Trúc: Đánh Đổi, Tranh Chấp Dữ Liệu & Chiến Lược Khóa (Locks)

Dưới đây là phân tích chi tiết về các đánh đổi thiết kế hệ thống phân tán, các vấn đề tranh chấp dữ liệu (Race Conditions) và giải pháp khóa dữ liệu (Locking) cho Hệ thống Vận chuyển NestJS.

---

## 1. Đánh Đổi Trong Giao Tiếp Giữa Các Dịch Vụ (Microservice Communication Trade-offs)

Khi áp dụng mô hình Microservices, giao tiếp giữa các module không còn là gọi hàm trong bộ nhớ (in-memory) mà là giao tiếp qua mạng (Network I/O).

```
   Luồng Đồng Bộ (REST HTTP):   [Order Service]  ──(Nghẽn/Đợi mạng)──>  [Pricing Service]
   Luồng Bất Đồng Bộ (NATS):     [Tracking Service]  ──>  [NATS JetStream]  ──>  [Order Service] (Eventual)
```

| Phương Thức | Điểm Mạnh | Điểm Yếu / Đánh Đổi | Vùng Áp Dụng |
| :--- | :--- | :--- | :--- |
| **Đồng Bộ (REST HTTP)** | Dễ lập trình, dữ liệu phản hồi ngay lập tức (Strong Consistency). | Tạo ra sự phụ thuộc chặt chẽ (Temporal Coupling). Nếu Service B sập, Service A sập theo. | Kiểm tra tồn kho, Xác thực Stripe, Tính giá cước tại thời điểm tạo đơn. |
| **Bất Đồng Bộ (NATS Event)** | Giảm thiểu coupling, tăng khả năng mở rộng (Scalability), chịu lỗi tốt (Fault Tolerance). | Dữ liệu chỉ nhất quán sau một khoảng thời gian (Eventual Consistency), khó debug vết lỗi. | Nhật ký sự kiện quét (`ScanEvent`), thông báo Email, đồng bộ trạng thái đơn hàng. |

### Giải quyết vấn đề "Dual Write" (Ghi DB thành công nhưng lỗi mạng gửi NATS thất bại):
Chúng ta áp dụng **Transactional Outbox Pattern**:
*   *Cách làm*: Không publish trực tiếp sự kiện lên NATS trong Controller. Ghi thông tin sự kiện vào một bảng `outbox` ngay trong cùng một Transaction ghi dữ liệu nghiệp vụ của Postgres.
*   *Kết quả*: Đảm bảo sự kiện chắc chắn được lưu và sẽ được một worker quét gửi đi kể cả khi mạng bị gián đoạn (At-least-once delivery).

---

## 2. Chiến Lược Độc Lập Dữ Liệu (Database-per-Service)

Việc áp dụng nguyên tắc **mỗi dịch vụ sở hữu cơ sở dữ liệu riêng** (Database-per-service) triệt tiêu hoàn toàn khả năng sử dụng lệnh liên kết bảng (`JOIN`) ở mức cơ sở dữ liệu giữa các dịch vụ.

### Nghiệp vụ phát sinh & Đánh đổi:
1.  **Dư thừa dữ liệu (Data Redundancy)**:
    *   *Vấn đề*: `order-service` cần trạng thái bưu gửi để tính trạng thái đơn hàng, nhưng thực thể gốc của sự kiện quét lại do `tracking-service` nắm giữ.
    *   *Đánh đổi*: Chấp nhận lưu thừa một cột trạng thái `state` tại bảng `parcels` của `order-service`. Cột này được cập nhật bất đồng bộ thông qua việc tiêu thụ sự kiện từ NATS.
2.  **API Composition (Gộp API)**:
    *   *Vấn đề*: Trang chi tiết hành trình đơn hàng cần hiển thị thông tin Người gửi (từ `order-service`) và dòng lịch sử quét (từ `tracking-service`).
    *   *Giải pháp*: API Gateway sẽ gọi song song 2 API của hai service và tự động gộp dữ liệu ở tầng Presentation/Gateway để trả về Client.

---

## 3. Các Loại Race Conditions Thường Gặp & Giải Pháp

Trong hệ thống hướng sự kiện vận hành song song chặng đầu - chặng cuối, các xung đột truy cập và thứ tự sự kiện rất dễ xảy ra:

### A. Sự kiện đến sai thứ tự (Out-of-Order Events)
*   *Hiện tượng*: Sự kiện quét giao hàng thành công `Delivered` đến trước cả sự kiện quét trung chuyển `In_Transit` do độ trễ của mạng di động của tài xế.
*   *Giải pháp*: 
    *   **Timestamp-based Guard**: So sánh thuộc tính `occurred_at` của sự kiện. Nếu sự kiện mới nhận có mốc thời gian cũ hơn sự kiện đã lưu cuối cùng của bưu gửi đó, hệ thống sẽ bỏ qua hoặc đưa vào xử lý ngoại lệ.
    *   **State Machine Validation**: Máy trạng thái tại `tracking-service` sẽ chặn đứng các lượt quét sai quy trình vật lý.

### B. Xử lý trùng lặp sự kiện (Idempotent Consumer)
*   *Hiện tượng*: Một sự kiện quét được NATS gửi lại nhiều lần (do timeout ack), khiến hệ thống tính toán lại cước phí hoặc gửi trùng email nhiều lần.
*   *Giải pháp*: 
    *   Mỗi sự kiện có một `event_id` duy nhất (UUID).
    *   Tại đầu nhận (Consumer), lưu lại danh sách các `event_id` đã xử lý thành công vào bảng `processed_events`. Nếu trùng, thực hiện trả Ack lập tức và không xử lý tiếp.

---

## 4. Chiến Lược Khóa Dữ Liệu (Locking Strategies)

Để giải quyết tranh chấp ghi dữ liệu đồng thời, chúng ta thiết lập 4 tầng khóa phù hợp cho từng vùng nghiệp vụ:

### A. Khóa Ở Mức Sự Kiện (Message-level Serialization) - Khuyến Nghị
*   *Cơ chế*: Dùng NATS JetStream với cấu hình định tuyến theo mã Đơn hàng `orders.status.<order_id>`.
*   *Ưu điểm*: Toàn bộ các cập nhật của cùng một đơn hàng được xếp hàng và xử lý tuần tự bởi một luồng xử lý duy nhất. **Không cần dùng khóa ở mức Database**, giúp tăng tốc độ đọc/ghi tối đa.

### B. Khóa Lạc Quan (Optimistic Locking)
*   *Cơ chế*: Thêm một cột phiên bản `version` vào bảng `orders` (sử dụng `@Version` của TypeORM).
    ```sql
    UPDATE orders SET status = 'Delivered', version = version + 1 WHERE id = :id AND version = :current_version;
    ```
*   *Ứng dụng*: Áp dụng khi tần suất cập nhật trùng lặp thấp (ví dụ: khách hàng cập nhật thông tin địa chỉ đơn hàng). Nếu có xung đột, hệ thống sẽ báo lỗi để client thử lại.

### C. Khóa Bi Quan (Pessimistic Locking)
*   *Cơ chế*: Thực hiện khóa hàng trực tiếp trong DB khi bắt đầu xử lý nghiệp vụ thông qua câu lệnh:
    ```sql
    SELECT * FROM payments WHERE id = :id FOR UPDATE;
    ```
*   *Ứng dụng*: Áp dụng cho các giao dịch liên quan đến **Stripe Webhook** hoặc **Quyết toán tiền mặt COD** của tài xế, nơi sự chính xác về tiền bạc là tuyệt đối và không được phép ghi đè sai lệch dữ liệu tài chính.

### D. Khóa Phân Tán (Distributed Lock - Redis Redlock)
*   *Cơ chế*: Sử dụng Redis để tạo một khóa toàn cục dựa trên ID tài nguyên (ví dụ khóa theo `driver_id` hoặc `truck_plate`).
*   *Ứng dụng*: Áp dụng cho nghiệp vụ điều phối chặng cuối (`Assign Driver`). Ngăn chặn tình huống 2 nhân viên vận hành phân phối cùng một tài xế hoặc cùng một xe tải vào 2 chuyến đi khác nhau tại cùng một mili-giây.
