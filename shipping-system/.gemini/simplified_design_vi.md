# Thiết Kế Hệ Thống Tối Giản (Simplified Modular Design)

Tài liệu này tái thiết kế lại bài toán Shipping System thành **5 bài toán nhỏ, độc lập và tăng dần mức độ phức tạp** để bạn có thể xây dựng và hoàn thành từng phần một cách tập trung, tránh bị loãng hoặc sa đà vào quá nhiều nghiệp vụ cùng lúc.

---

## Bài Toán 1: Mô Hình Dữ Liệu Tối Giản & Quản Lý Đơn Hàng (Order & Parcel)
**Mục tiêu**: Tạo khung xương dữ liệu và xử lý tạo đơn hàng cơ bản. Không có trạng thái phức tạp, không sự kiện NATS.

1.  **Thiết kế Entity/Bảng**:
    *   `Order`: Lưu `id`, `sender_address`, `recipient_address`, `total_price_cents` (đơn vị xu/cents để tránh số thập phân).
    *   `Parcel`: Lưu `id`, `order_id`, `weight_grams`, `dimensions` (dài-rộng-cao), và `status` hiện tại.
2.  **Logic cốt lõi**:
    *   Tạo API tạo Đơn hàng kèm danh sách Bưu gửi.
    *   Tính cước đơn giản (ví dụ: cước = khối lượng * đơn giá cố định) và lưu/khóa giá trực tiếp vào `total_price_cents`.
3.  **Kết quả**: Bạn có thể tạo được đơn hàng và các bưu gửi đi kèm trong cơ sở dữ liệu với mức cước đã tính toán.

---

## Bài Toán 2: Máy Trạng Thái Bưu Gửi & Nhật Ký Quét (Parcel State Machine & Scan Ledger)
**Mục tiêu**: Quản lý vòng đời bưu gửi thông qua nhật ký quét (append-only) thay vì sửa trực tiếp database.

1.  **Thiết kế Entity/Bảng**:
    *   `ScanEvent`: Lưu `id`, `parcel_id`, `status` (Created, Picked_Up, In_Transit, Delivered, Delivery_Failed, RTS), `location_hub_id`, `created_at`.
2.  **Logic cốt lõi**:
    *   Mỗi khi bưu gửi thay đổi vị trí/trạng thái, **KHÔNG** dùng lệnh `UPDATE` bưu gửi. Hãy chèn (`INSERT`) một dòng mới vào bảng `ScanEvent`.
    *   Viết hàm/query để lấy ra trạng thái hiện tại của Bưu gửi bằng cách tìm `ScanEvent` mới nhất của bưu gửi đó.
    *   Viết hàm kiểm tra luật chuyển trạng thái (ví dụ: bưu gửi phải ở trạng thái `In_Transit` thì mới được chuyển sang `Delivered`).
3.  **Kết quả**: Bưu gửi có máy trạng thái hoạt động chặt chẽ và lưu lại toàn bộ lịch sử di chuyển phục vụ cho tính năng tracking đơn hàng.

---

## Bài Toán 3: Liên Kết Dịch Vụ Qua Sự Kiện Bất Đồng Bộ (NATS JetStream)
**Mục tiêu**: Tách biệt luồng xử lý đơn hàng và luồng cập nhật tracking thông qua Message Broker.

1.  **Thiết kế Hợp Đồng Sự Kiện (Event Contracts)**:
    *   Định nghĩa sự kiện `ParcelScannedEvent` dạng JSON chứa thông tin: `parcel_id`, `status`, `location`.
2.  **Logic cốt lõi**:
    *   Khi có sự kiện quét bưu gửi (ví dụ nhập kho), phát đi sự kiện lên NATS JetStream.
    *   Viết một consumer (lắng nghe sự kiện) để cập nhật lại bảng hình chiếu trạng thái đơn hàng (`ORDER.status = min(Parcels.status)`).
3.  **Kết quả**: Hệ thống chạy bất đồng bộ hoàn toàn. Việc quét hàng (chặng vật lý) không ảnh hưởng trực tiếp đến hiệu năng của service quản lý đơn hàng.

---

## Bài Toán 4: Điều Phối & Giao Hàng Thất Bại (Driver Assignment & Delivery Attempt)
**Mục tiêu**: Xử lý chặng giao hàng cuối (last-mile) và nghiệp vụ hoàn hàng tự động khi giao lỗi.

1.  **Thiết kế Entity/Bảng**:
    *   `CourierAssignment`: Lưu thông tin tài xế được phân công đi lấy/giao bưu gửi.
    *   `DeliveryAttempt`: Lưu `id`, `parcel_id`, `attempt_number` (1, 2, 3), `failure_reason` (ví dụ: khách hẹn lại, không liên lạc được).
2.  **Logic cốt lõi**:
    *   Khi tài xế báo giao thất bại, chèn một dòng vào `DeliveryAttempt`.
    *   Nếu `attempt_number` đạt tới 3, hệ thống tự động chèn một sự kiện quét hoàn hàng (`RTS`), đổi hướng đi bưu gửi thành `Reverse` để đưa về kho phát gốc.
3.  **Kết quả**: Hệ thống tự động hóa được quy trình xử lý lỗi giao hàng phổ biến nhất trong logistics.

---

## Bài Toán 5: Thanh Toán & Quyết Toán Tiền Thu Hộ (Payment & Settlement COD)
**Mục tiêu**: Xử lý dòng tài chính của bưu gửi (trả trước hoặc COD chặng cuối).

1.  **Thiết kế Entity/Bảng**:
    *   `Payment`: Lưu hình thức thanh toán (`PREPAID` hoặc `COD`), số tiền thu hộ.
    *   `CODSettlement`: Quản lý giao dịch quyết toán khi tài xế nộp lại tiền mặt thu hộ sau ca giao hàng.
2.  **Logic cốt lõi**:
    *   Khi trạng thái bưu gửi chuyển sang `Delivered`:
        *   Nếu là `PREPAID`: Đơn hàng hoàn thành tài chính ngay lập tức.
        *   Nếu là `COD`: Đơn hàng chuyển sang trạng thái chờ quyết toán tài chính từ tài xế.
    *   Tạo luồng quyết toán đơn giản: Xác nhận tiền mặt thực tế đã nộp về Hub từ tài xế khớp với tổng COD của các bưu gửi `Delivered`.
3.  **Kết quả**: Dòng tiền của hệ thống được đối soát chặt chẽ với thực tế vận hành chặng cuối.
