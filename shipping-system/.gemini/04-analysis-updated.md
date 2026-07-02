# Phân Tích Nghiệp Vụ Tinh Giản (Domain Analysis & Actors)

Tài liệu này định nghĩa rõ ràng bài toán cụ thể, phân tích vai trò của từng tác nhân (Actors) và thiết lập phạm vi ranh giới nghiệp vụ tinh giản để phục vụ trực tiếp cho việc triển khai dự án.

---

## 1. Xác Định Bài Toán Cụ Thể (Problem Definition)
Hệ thống vận chuyển bưu gửi nội địa chặng đầu - chặng cuối (Standard Shipping) kết nối giữa Người gửi và Người nhận thông qua mạng lưới kho trung chuyển (Hubs) và đội ngũ tài xế giao nhận (Couriers). 

Để tránh sự lan man từ tài liệu đặc tả cũ, hệ thống **chỉ tập trung** giải quyết bài toán theo dõi trạng thái bưu gửi chặng đơn lẻ (Parcel-level tracking), xử lý thanh toán COD chặng cuối, và tự động xử lý chuyển hoàn khi giao lỗi.

---

## 2. Phân Tích Tác Nhân (Actor Mapping)

| Tác Nhân (Actor) | Vai Trò Nghiệp Vụ | Tương Tác Với Hệ Thống |
| :--- | :--- | :--- |
| **Sender (Người gửi)** | Tạo đơn hàng, chuẩn bị gói hàng và bàn giao hàng. | Gọi API `POST /orders` để tạo và xem cước phí cố định được khóa cứng. |
| **Courier (Tài xế)** | Thu gom chặng đầu (First-mile) và đi giao chặng cuối (Last-mile). | Gọi API quét lấy hàng (`Picked_Up`), giao hàng thành công kèm ảnh/chữ ký (`Delivered`), hoặc báo giao lỗi (`Delivery_Failed`). |
| **Hub Operator (Nhân viên kho)** | Khai thác, nhập/xuất kho trung chuyển và phân loại hàng. | Thực hiện quét nhận bưu gửi tại các Hub trung gian (`At Origin Hub`, `Sorting`, `At Destination Hub`). |
| **Finance (Kế toán)** | Đối soát tài chính và dòng tiền mặt. | Xác nhận quyết toán COD (`Settlement COD`) từ tài xế nộp tiền mặt cuối ca. |
| **System (Hệ thống)** | Tự động hóa trạng thái, định tuyến và truyền thông điệp. | Phân tích máy trạng thái, phát hiện thất lạc, và tự động hóa RTS khi giao thất bại 3 lần. |

---

## 3. Ranh Giới Phạm Vi Nghiệp Vụ (In-Scope vs Out-of-Scope)

### Nằm Trong Phạm Vi (In-Scope)
*   **Trạng thái Parcel-level**: Toàn bộ lịch sử di chuyển chỉ gắn với `parcel_id` đơn lẻ.
*   **Nhật ký append-only**: Mỗi hành động quét tạo một dòng `ScanEvent` mới, không bao giờ sửa đè.
*   **NATS JetStream Event Chain**: Microservices giao tiếp bất đồng bộ qua luồng sự kiện.
*   **Delivery Attempts Counter**: Đếm số lần giao lỗi và kích hoạt hoàn hàng (RTS) tự động.
*   **Bảo mật dữ liệu (FLE)**: Mã hóa thông tin cá nhân của khách hàng gửi/nhận (PII) trước khi ghi vào PostgreSQL.

### Bị Loại Bỏ (Out-of-Scope)
*   **Bao hàng & Bảng kê (Bags & Manifests)**: Không tạo bảng quản lý bao hàng hay bảng xếp xe.
*   **Đối soát Manifest**: Cắt bỏ luồng đối soát thừa/thiếu khi dỡ xe manifest. Sự cố thất lạc được phát hiện thụ động qua thời gian chờ SLA chặng vận chuyển.
*   **Mã hóa toàn phần (Full DB Encryption)**: Chỉ mã hóa trường nhạy cảm (FLE), thông tin vùng/địa chỉ nhận được để plaintext để định tuyến nhanh.
