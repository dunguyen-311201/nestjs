# Đánh Giá Phạm Vi & Quy Tắc Nghiệp Vụ (Shipping System)

Tài liệu này cung cấp bản so sánh và đánh giá phạm vi giữa đặc tả chung trên **Google Doc** và phiên bản **16-day Scoped Vertical Slice** được định nghĩa trong [CLAUDE.md](file:///home/dunguyen/Training/nestjs/shipping-system/CLAUDE.md) và [docs/04-business-rules.md](file:///home/dunguyen/Training/nestjs/shipping-system/docs/04-business-rules.md).

---

## 1. Phân Tích Sự Mâu Thuẫn Về Phạm Vi (Scope)

Sự khác biệt lớn nhất giữa tài liệu Google Doc và cấu hình hiện tại của dự án là việc loại bỏ các thực thể gom hàng vật lý (**Bao hàng - Bags** và **Bảng kê - Manifests**).

| Tính năng / Khái niệm | Google Doc (Đặc tả chung) | Phạm vi thực tế của dự án ([CLAUDE.md](file:///home/dunguyen/Training/nestjs/shipping-system/CLAUDE.md)) | Hệ quả khi triển khai |
| :--- | :--- | :--- | :--- |
| **Bao hàng & Bảng kê** | **Có bao gồm**: Được mô hình hóa thành các thực thể DB. Cấu trúc: `Bưu gửi (Parcel) -> Bao hàng (Bag) -> Bảng kê (Manifest) -> Chuyến đi (Trip)`. | **BỊ CẮT**: Chỉ là hành động vật lý. **Không mô hình hóa thành bảng/thực thể** trong cơ sở dữ liệu. | Bưu gửi (Parcel) sẽ liên kết trực tiếp với Điểm kết nối (Hub) và Chuyến đi (Trip). Không lồng trong bao hay bảng kê. |
| **Logic Gom/Rã hàng** | **Có bao gồm**: Logic đóng gói bưu gửi vào bao hàng và rã hàng tại các hub đích. | **BỊ CẮT**: Hệ thống không ghi nhận trạng thái hay thực hiện nghiệp vụ trên các nhóm trung gian này. | Trạng thái bưu gửi thay đổi trực tiếp thông qua các lượt quét (scan) đơn lẻ của từng bưu gửi. |
| **Đối soát Bảng kê** | **Có bao gồm**: Logic kiểm tra thừa/thiếu bưu gửi so với bảng kê khi nhận hàng tại Hub. | **BỊ CẮT**: Chỉ theo dõi thụ động. | Bưu gửi thất lạc sẽ được phát hiện thụ động (không xuất hiện lượt quét tại hub tiếp theo) thay vì đối soát chủ động qua bảng kê. |
| **Sự kiện Quét (Scan)** | **Quét đa cấp**: Quét bảng kê, quét bao hàng, và quét bưu gửi. | **Chỉ quét bưu gửi**: `ScanEvent` chỉ tham chiếu trực tiếp đến `parcel_id` (không đa hình - non-polymorphic). | Cấu trúc sự kiện quét được đơn giản hóa tối đa, chỉ hỗ trợ quét bưu gửi đơn lẻ. |

---

## 2. So Sánh Quy Tắc Nghiệp Vụ (Business Rules)

Dưới đây là các quy tắc nghiệp vụ đã được chuẩn hóa và đánh số lại trong phạm vi tinh giản (Scoped Slice):

### Quy tắc không đổi
*   **BR-01 (Giá cố định)**: Giá cước được tra cứu qua bảng giá (rate-card) và khóa cứng ngay khi tạo đơn hàng.
*   **BR-03 (Nhật ký quét append-only)**: Nhật ký quét chỉ cho phép ghi thêm (append-only). Các sửa đổi phải tạo sự kiện bù trừ (compensating event) mới, không bao giờ `UPDATE` hay `DELETE` trực tiếp trong DB.
*   **BR-02 (Giao hàng sai Hub)**: Bưu gửi chỉ có thể chuyển sang trạng thái đi giao (`Out_for_Delivery`) sau khi đã quét nhận tại Hub đích. Nếu quét tại sai Hub, bưu gửi sẽ chuyển sang trạng thái `Misrouted` (Sai tuyến), hệ thống sẽ chặn việc chuyển tiếp và phát ra sự kiện định tuyến lại.

### Quy tắc được sửa đổi hoặc cập nhật mới
*   **BR-04 (Quy trình chuyển hoàn - RTS)**: Sau 3 lần giao hàng thất bại, bưu gửi sẽ chuyển sang quy trình chuyển hoàn (RTS). Trong phạm vi tinh giản này, bưu gửi vẫn giữ nguyên mã vận đơn (tracking ID) ban đầu và cập nhật hướng vận chuyển `direction = Reverse` (để tránh vòng lặp định tuyến vô hạn).
*   **BR-05 & BR-07 (Đồng bộ trạng thái & Hiệu năng đơn hàng)**:
    *   Trạng thái của Đơn hàng (`ORDER.status`) là một hình chiếu tổng hợp (materialized projection) được tính theo *trạng thái chậm nhất (least-advanced)* của các bưu gửi thuộc đơn hàng đó.
    *   Để đáp ứng tiêu chuẩn phản hồi nhanh (<300ms) khi tải cao, các sự kiện quét cập nhật trạng thái đơn hàng sẽ được tuần tự hóa (serialized) thông qua NATS JetStream theo chủ đề riêng của từng đơn hàng (`orders.status.<order_id>`) và được gom nhóm/gộp sự kiện (debounced/batched).
*   **BR-06 (Đối soát trọng lượng)**: Nếu trọng lượng đo thực tế tại Hub khác với trọng lượng người gửi khai báo, bưu gửi **vẫn tiếp tục được vận chuyển** (không giữ lại); chênh lệch cước phí sẽ được đối soát và xử lý sau (điều chỉnh COD hoặc xuất hóa đơn bổ sung sau khi giao).

---

## 3. Khuyến Nghị Thiết Kế Cơ Sở Dữ Liệu & Code

Để đảm bảo code tuân thủ đúng phạm vi tinh giản 16 ngày:

1.  **KHÔNG tạo các bảng** `Bag`, `Manifest`, hoặc `ManifestReconciliation` trong cơ sở dữ liệu.
2.  **Đảm bảo `ScanEvent` tham chiếu trực tiếp đến `parcel_id`** bằng kiểu UUID thông thường, không dùng liên kết đa hình (polymorphic references).
3.  **Triển khai logic giải quyết trạng thái** sao cho `Order.status = min(Parcels.status)`.
4.  **Kiểm soát chặt chẽ máy trạng thái (State Machine)** của thực thể `Parcel` (ví dụ: `HUB_RECEIVE` -> `IN_TRANSIT` -> `DELIVERED`/`RTS`/`LOST`).
