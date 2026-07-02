# Thiết Kế Hệ Thống Cơ Sở Dữ Liệu & Tối Ưu Hóa (Database System Design)

Tài liệu này đặc tả phương án tổ chức, phân hoạch (Partitioning), đánh chỉ mục (Indexing), quản lý kết nối (Connection Pooling), và chiến lược bảo mật cho hệ thống cơ sở dữ liệu PostgreSQL của Shipping System.

---

## 1. Phân Hoạch Dữ Liệu (Table Partitioning)

Trong hệ thống vận chuyển, bảng `scan_events` (Nhật ký hành trình bưu gửi) là bảng có tốc độ tăng trưởng dữ liệu cực kỳ nhanh (2.500 lượt quét/giây $\rightarrow$ hơn 200 triệu bản ghi/ngày). Để tránh việc suy giảm hiệu năng khi truy vấn bảng lớn, chúng ta áp dụng chiến lược **Time-Range Partitioning (Phân hoạch theo thời gian)** kết hợp **List Partitioning (Phân hoạch theo Hub)**.

```
                  Bảng cha: [scan_events]
                             │
            ┌────────────────┴────────────────┐
            ▼                                 ▼
   Phân hoạch: [scan_events_2026_Q1]    Phân hoạch: [scan_events_2026_Q2]
            │                                 │
      ┌─────┴─────┐                     ┌─────┴─────┐
      ▼           ▼                     ▼           ▼
   [Hub_01]    [Hub_02]              [Hub_01]    [Hub_02]
```

### Phương án triển khai:
*   **Bảng Cha**: `scan_events` (Chỉ chứa định nghĩa cấu trúc, không lưu trữ dữ liệu trực tiếp).
*   **Khóa Phân Hoạch (Partition Key)**: `created_at` (Kiểu `TIMESTAMP` hoặc `DATE`).
*   **Chu Kỳ Phân Hoạch**: Tạo phân hoạch tự động theo **Từng Tháng (Monthly)**.
    *   Ví dụ: `scan_events_y2026m07` sẽ chứa tất cả các bản ghi có `created_at` trong tháng 07/2026.
*   **Lợi ích**:
    *   *Tối ưu hóa Truy vấn (Partition Pruning)*: Khi khách hàng tìm hành trình đơn hàng tạo trong tháng này, PostgreSQL chỉ quét phân hoạch của tháng đó, bỏ qua 99% dữ liệu cũ.
    *   *Dọn dẹp dữ liệu cũ (Data Archiving/Purging)*: Khi cần xóa dữ liệu cũ quá 2 năm, chỉ cần thực hiện lệnh `DROP TABLE` phân hoạch cũ thay vì chạy lệnh `DELETE` nặng nề gây khóa bảng và phân mảnh DB.

---

## 2. Chiến Lược Đánh Chỉ Mục (Indexing Strategies)

Việc đánh chỉ mục hợp lý giúp cân bằng giữa tốc độ đọc (Read) và ghi (Write) của hệ thống.

### Bảng `scan_events` (Database `db_tracking`):
*   **Chỉ mục phức hợp (Composite Index)**: `idx_scan_events_parcel_created (parcel_id, created_at DESC)`.
    *   *Mục đích*: Hỗ trợ truy vấn nhanh lịch sử hành trình chặng cuối của một bưu gửi cụ thể, sắp xếp từ mới nhất đến cũ nhất.
*   **Chỉ mục phụ**: `idx_scan_events_hub (hub_id)` lọc theo `created_at`.
    *   *Mục đích*: Phục vụ màn hình Dashboard hiển thị lượng hàng đang tồn đọng tại một Hub cụ thể.

### Bảng `orders` & `parcels` (Database `db_order`):
*   **Chỉ mục khóa ngoại**: `idx_orders_sender (sender_id)`, `idx_orders_recipient (recipient_id)`.
    *   *Mục đích*: Tăng tốc độ truy vấn danh sách đơn hàng đã gửi/nhận của một khách hàng cụ thể.
*   **Chỉ mục trạng thái**: `idx_orders_status (status)`.
    *   *Mục đích*: Lọc nhanh các đơn hàng đang ở trạng thái hoạt động (`Created`, `Picked_Up`, `In_Transit`) để giám sát vận hành.

---

## 3. Quản Lý Kết Nối & Tối Ưu Hóa Tài Nguyên (Connection Pooling)

Khi microservices co giãn (scale-out) thành nhiều thực thể (pods) chạy song song, số lượng kết nối đồng thời tới PostgreSQL sẽ tăng vọt, dễ gây lỗi nghẽn cổng kết nối của Postgres (mặc định giới hạn 100 kết nối).

```
   [Service Pod 1] ──(Pool size: 10)──┐
   [Service Pod 2] ──(Pool size: 10)──┼──> [pgBouncer (Pooler)] ──(Max 90 conn)──> [PostgreSQL]
   [Service Pod 3] ──(Pool size: 10)──┘
```

### Phương án triển khai:
1.  **Cấu hình Connection Pool trong NestJS (TypeORM)**:
    *   Không để kích thước kết nối mặc định quá lớn. Cấu hình giới hạn tối đa kết nối của mỗi Pod:
        ```typescript
        extra: {
          max: 10,       // Kích thước tối đa của connection pool trên một Pod
          idleTimeoutMillis: 30000,
          connectionTimeoutMillis: 2000,
        }
        ```
2.  **Sử dụng pgBouncer làm Connection Proxy (Trong Production)**:
    *   pgBouncer đóng vai trò là một proxy gom kết nối (Connection Multiplexing). Giúp tái sử dụng kết nối liên tục từ hàng trăm pods của NestJS về PostgreSQL mà không cần tạo mới kết nối TCP vật lý.

---

## 4. Bảo Mật & Mã Hóa Dữ Liệu Nhạy Cảm (PII Encryption & Search)

Các thông tin nhạy cảm của khách hàng (`name_enc`, `phone_enc`, `address_enc`) được mã hóa ứng dụng bằng thuật toán AES-256-GCM.

### Bài toán tìm kiếm dữ liệu mã hóa:
*   *Vấn đề*: Vì dữ liệu đã bị mã hóa thành chuỗi ngẫu nhiên (Ciphertext), chúng ta không thể thực hiện câu lệnh tìm kiếm gần đúng (`LIKE '%Nguyen%'`) hay tìm kiếm theo số điện thoại chính xác của khách hàng trên database.
*   *Giải pháp*: **Blind Index (Chỉ mục mù)**
    *   Tạo thêm một cột chỉ mục phụ không đối xứng, ví dụ: `phone_hash`. Cột này lưu mã băm bảo mật (HMAC-SHA256) của trường dữ liệu plaintext tương ứng:
        $$\text{phone\_hash} = \text{HMAC-SHA256}(\text{phone}, \text{secret\_salt})$$
    *   Khi khách hàng tìm đơn bằng số điện thoại, ứng dụng sẽ băm số điện thoại đó rồi so sánh bằng (`=`) với cột `phone_hash` trên DB (PostgreSQL đánh Index B-Tree bình thường trên cột băm này để tăng tốc độ tìm kiếm).
