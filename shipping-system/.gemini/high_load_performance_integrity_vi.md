# Đảm Bảo Hiệu Năng & Tính Toàn Vẹn Dữ Liệu Khi Tải Cao (High Load & Data Integrity)

Tài liệu này phân tích giải pháp kỹ thuật giúp hệ thống chịu tải lớn vào giờ cao điểm nhập kho (hàng ngàn lượt quét/giây khi container đổ hàng xuống Hub) mà vẫn đảm bảo tính toàn vẹn dữ liệu tuyệt đối và thời gian phản hồi thấp.

---

## 1. Cơ Chế Tiêu Tán Tải (Shock Absorber) Bằng NATS JetStream

Để tránh việc cơ sở dữ liệu PostgreSQL bị sập (Crash) do hàng ngàn kết nối ghi đồng thời từ máy quét của nhân viên kho, hệ thống áp dụng kiến trúc **Xử lý bất đồng bộ chọc lọc**:

```
   [Máy quét tại Hub] ──> (HTTP Write) ──> [Tracking Service] ──(Ghi nhanh ScanEvent)
                                                │
                                                ▼ (Đẩy cực nhanh vào NATS)
                                         [NATS JetStream] (Dự trữ/Đệm dòng dữ liệu)
                                                │
                                                ▼ (Tiêu thụ tuần tự theo năng lực DB)
                                         [Order Service] ──> [db_order] (Xử lý nặng/Cập nhật trạng thái)
```

1.  **Tách biệt luồng ghi nhanh (Write Path)**:
    *   Dịch vụ `tracking-service` chỉ làm nhiệm vụ cực kỳ nhẹ: Nhận HTTP POST, ghi 1 dòng sự kiện quét vào `db_tracking`, đẩy thông điệp vào NATS JetStream rồi trả về `200 OK` lập tức cho nhân viên kho (thời gian phản hồi < 20ms).
2.  **Bộ đệm JetStream (Backpressure & Buffer)**:
    *   NATS JetStream đóng vai trò là bể chứa dữ liệu. Nếu `order-service` bị quá tải do phải thực hiện các phép tính cước phức tạp hoặc đồng bộ trạng thái, JetStream sẽ giữ các sự kiện này lại một cách an toàn trên đĩa cứng. Dữ liệu không bị mất và được xử lý dần dần theo đúng năng lực xử lý của database (Rate Limiting/Backpressure).

---

## 2. Giải Quyết Tranh Chấp Cơ Sở Dữ Liệu & Race Conditions

Vào giờ cao điểm, nhiều kiện hàng của cùng một đơn hàng lớn có thể được quét đồng thời tại các băng chuyền khác nhau.

*   **Tuần tự hóa luồng ghi bằng Subject Key**:
    *   Chúng ta phân tách các thông điệp cập nhật trạng thái đơn hàng theo mã đơn hàng: `orders.status.<order_id>`.
    *   NATS JetStream đảm bảo các tin nhắn gửi vào cùng một mã đơn hàng sẽ được xử lý tuần tự (Single-threaded consumer per partition key). Do đó, `order-service` không bao giờ gặp tình trạng hai tiến trình cùng cố gắng cập nhật một dòng dữ liệu `Order` cùng một lúc, loại bỏ hoàn toàn lỗi **Deadlock** trên database.
*   **Idempotency (Đảm bảo thực thi đúng 1 lần - Exactly-once sematics)**:
    *   Tất cả các tin nhắn quét hàng đều mang theo một khóa duy nhất `event_id` (UUID).
    *   Khi `order-service` tiêu thụ sự kiện, hệ thống kiểm tra sự tồn tại của `event_id` trong bảng đối soát. Nếu sự kiện đã được xử lý (do NATS gửi lại khi mạng chập chờn), hệ thống sẽ bỏ qua ngay lập tức, đảm bảo tính toàn vẹn và không bị tính cước lặp.

---

## 3. Tối Ưu Hóa Query Đọc Bằng CQRS & Redis Cache

Trong giờ cao điểm, lượng khách hàng tra cứu hành trình (Read) và lượng máy quét đẩy sự kiện (Write) đều tăng cao. Chúng ta áp dụng mô hình **CQRS tinh giản**:

```
   [Ghi sự kiện] ──> [PostgreSQL] ──(Cập nhật hình chiếu)──> [Redis Cache]
                                                                  ▲
   [Tra cứu API] ────────────────(Tốc độ < 10ms)─────────────────┘
```

*   **Tách biệt luồng Đọc/Ghi**:
    *   Toàn bộ luồng ghi sẽ ghi trực tiếp vào PostgreSQL.
    *   Toàn bộ luồng tra cứu hành trình của Khách hàng hoặc API của tài xế sẽ đọc trực tiếp từ **Redis Cache** (lưu trữ sẵn dạng JSON hành trình hoàn chỉnh).
*   **Chiến lược dọn Cache (Cache Invalidation)**:
    *   Khi có sự kiện quét mới ghi vào PostgreSQL thành công, hệ thống sẽ đẩy một sự kiện dọn cache. Redis sẽ được cập nhật bất đồng bộ, đảm bảo tính nhất quán dữ liệu hiển thị trong vòng dưới 1 giây mà không gây nghẽn PostgreSQL.

---

## 4. Quét Hàng Loại Lớn (Batch Scanning) để Tối Ưu

Đối với vận chuyển, việc quét từng bưu gửi nhỏ khi xếp lên xe tải container là không tối ưu.
*   *Phương án*: Hệ thống hỗ trợ nghiệp vụ quét gộp. Khi xe tải liên tỉnh xuất phát, hệ thống chỉ phát đi duy nhất 1 sự kiện `trip.departed` hoặc `manifest.sealed` chứa danh sách 1,000 mã bưu gửi.
*   *Kết quả*: PostgreSQL chỉ thực hiện 1 câu lệnh ghi hàng loạt (Bulk Insert/Batch Update) thay vì chạy 1,000 câu lệnh ghi đơn lẻ, giảm thiểu 90% số lượng I/O trên đĩa cứng của database.
