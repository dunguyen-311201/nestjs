# Phân Tích Thực Tế: Quyết Định & Đánh Đổi (Nghiệp Vụ vs Kỹ Thuật)

Tài liệu này tổng hợp các quyết định chiến lược (Nghiệp vụ và Kỹ thuật) kèm theo những đánh đổi (trade-offs) thực tế khi xây dựng một Hệ thống Giao nhận Nội địa.

---

## 1. Quyết Định Nghiệp Vụ & Đánh Đổi (Business Decisions & Trade-offs)

### A. Chiến lược khóa giá cước (Upfront Price Locking) vs Đối soát cân nặng
*   **Quyết định**: Cước phí được tính dựa trên thông tin khai báo của khách và **khóa cứng** ngay khi tạo đơn (`Confirmed`). Nếu khi nhập kho có sai lệch khối lượng/thể tích, hàng vẫn tiếp tục đi, việc đối soát được thực hiện sau.
*   **Đánh đổi**:
    *   *Mặt tốt*: Tăng trải nghiệm khách hàng tối đa vì giá không bị thay đổi đột ngột. Bưu gửi không bị giữ lại tại kho (On-Hold), đảm bảo cam kết thời gian giao hàng (SLA).
    *   *Rủi ro (Rò rỉ doanh thu)*: Khách hàng có thể cố tình khai báo thiếu khối lượng. Doanh nghiệp chịu rủi ro công nợ khó đòi hoặc phải tốn chi phí vận hành đội ngũ đối soát tài chính chặng cuối.

### B. Định tuyến phân vùng cố định (Static Corridors) vs Tối ưu hóa tuyến đường động (Dynamic Route Optimization)
*   **Quyết định**: Định tuyến bưu gửi đi qua các Hub trung chuyển cố định dựa trên mã vùng (`region_code` / `Zone`).
*   **Đánh đổi**:
    *   *Mặt tốt*: Cực kỳ đơn giản để thiết kế và lập trình. Tốc độ xử lý định tuyến tại kho nhanh.
    *   *Mặt xấu*: Không tối ưu được quãng đường di chuyển của xe tải trong các trường hợp thời tiết xấu hoặc tắc nghẽn giao thông. Chi phí nhiên liệu vận hành cao hơn so với giải pháp sử dụng AI/GPS để tối ưu tuyến đường động.

### C. Quy trình chuyển hoàn nghiêm ngặt (Strict RTS)
*   **Quyết định**: Tự động chuyển hoàn trả lại hàng (`RTS`) sau đúng 3 lần giao thất bại hoặc khi người nhận bấm từ chối nhận.
*   **Đánh đổi**:
    *   *Mặt tốt*: Giải phóng không gian lưu kho tại Hub đích, tránh hàng hóa bị tồn đọng lâu ngày gây hỏng hóc/thất lạc.
    *   *Mặt xấu*: Tăng chi phí logistics ngược (Reverse Logistics). Nếu khách hàng chỉ hẹn lại ngày và vẫn muốn mua, việc tự động hoàn hàng sẽ làm giảm tỷ lệ giao thành công của các shop bán hàng.

---

## 2. Quyết Định Kỹ Thuật & Đánh Đổi (Technical Decisions & Trade-offs)

### A. Microservices (NestJS + NATS) vs Monolith (Đơn khối)
*   **Quyết định**: Tách hệ thống thành các service độc lập (`order-service`, `tracking-service`, `payment-service`) kết nối qua NATS JetStream.
*   **Đánh đổi**:

| Chỉ Số Đánh Giá | Mô Hình Monolith (Đơn Khối) | Mô Hình Microservices (Đề Xuất) |
| :--- | :--- | :--- |
| **Độ phức tạp triển khai** | Rất thấp (Một DB, một repo, chạy local dễ dàng). | Cao (Phải cấu hình NATS, quản lý nhiều kết nối database, đồng bộ hóa sự kiện). |
| **Tính cô lập lỗi (Blast Radius)**| Thấp (Một module lỗi có thể kéo sập toàn bộ ứng dụng). | Cao (Dịch vụ thanh toán Stripe lỗi không ảnh hưởng đến việc quét nhận hàng tại Hub). |
| **Tính nhất quán dữ liệu** | Giao dịch ACID tuyệt đối trên toàn bộ các bảng. | Eventual Consistency (Chấp nhận độ trễ đồng bộ dữ liệu giữa các kho). |

### B. Nhật ký sự kiện quét (Append-only Scan Ledger) làm nguồn dữ liệu gốc
*   **Quyết định**: Không lưu trạng thái bưu gửi dưới dạng cập nhật cột đè trong bảng `parcels` của tracking. Mỗi lần quét tạo một `ScanEvent` mới. Trạng thái hiện tại được suy luận từ sự kiện mới nhất.
*   **Đánh đổi**:
    *   *Mặt tốt*: Có toàn bộ lịch sử hành trình chi tiết (Audit Trail) để hiển thị cho khách hàng tra cứu. Đảm bảo dữ liệu không bị sửa đổi trái phép (chống gian lận nội bộ).
    *   *Mặt xấu*: Bảng `scan_events` sẽ phình to rất nhanh khi quy mô đơn hàng tăng (hàng triệu lượt quét mỗi ngày). Query lấy trạng thái hiện tại sẽ tốn CPU/IO hơn so với việc đọc trực tiếp một cột trạng thái đơn giản.

### C. Chiến lược bộ đệm Redis để phục vụ truy vấn (<300ms)
*   **Quyết định**: Sử dụng Redis làm bộ nhớ đệm (Cache) để lưu trữ trạng thái hiển thị của đơn hàng (`ORDER.status`) và dòng lịch sử tracking.
*   **Đánh đổi**:
    *   *Mặt tốt*: Tốc độ truy vấn của khách hàng cực nhanh (dưới 10ms), đáp ứng dễ dàng SLA hệ thống. Giảm tải tối đa cho PostgreSQL.
    *   *Khó khăn*: Phải quản lý việc xóa/cập nhật cache (Cache Invalidation) đồng bộ với luồng sự kiện NATS. Có khả năng xảy ra tình trạng dữ liệu hiển thị trên cache bị cũ/lệch so với database nếu luồng xóa cache bị lỗi.
