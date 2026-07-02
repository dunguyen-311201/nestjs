# Phân Tích Quy Trình Đề Xuất & So Sánh Với Thiết Kế Hiện Tại (Standard Shipping)

Tài liệu này phân tích quy trình nghiệp vụ thực tế mới do bạn đề xuất và so sánh chi tiết với mô hình phân tích hiện tại (**Level 2 - Standard Shipping / Scoped Slice 16 ngày**) trong thiết kế gốc của dự án.

---

## 1. Bảng So Sánh Quy Trình (Workflow)

| Quy Trình Hiện Tại (Standard Shipping - Scoped) | Quy Trình Đề Xuất (Doanh Nghiệp Thực Tế) | Phân Tích & Điểm Khác Biệt |
| :--- | :--- | :--- |
| **1. Khách hàng tạo đơn** | **1. Create Order** | Giống nhau. Cước phí được khóa ở bước này. |
| (Thực hiện ngầm trong service tạo đơn) | **2. Verify Address** | Đề xuất tách rõ bước xác thực địa chỉ để tính Zone. |
| **2. Tra cứu bảng giá & khóa giá** | **3. Calculate Shipping Fee** | Giống nhau (BR-01). Tính cước dựa trên Zone và trọng lượng. |
| **3. Thanh toán / Khai báo COD** | **4. Payment/COD** | Khai báo hình thức thanh toán (COD hoặc trả trước). |
| (Đơn chuyển thẳng sang Active) | **5. Confirm Order** | Đơn hàng qua bước xác nhận thủ công/tự động trước khi gom. |
| (Gán tài xế gom hàng) | **6. Assign Driver** | Tách biệt rõ nghiệp vụ điều phối tài xế lấy hàng. |
| **4. Tài xế lấy hàng (First-mile)** | **7. Pickup** | Bắt đầu hành trình vật lý của bưu gửi. |
| **5. Nhập Hub gốc + Cân đo lại** | **8. Move to Sorting Hub** | Đưa bưu gửi về kho khai thác/phân loại ban đầu. |
| (Không mô hình hóa bước phân loại chi tiết) | **9. Sorting** | Phân loại hàng theo phân vùng/Hub đích. |
| **6. Vận chuyển liên tỉnh (Line-haul)** | **10. Transport** | Vận chuyển giữa các kho trung chuyển (In Transit). |
| **7. Nhập Hub đích** | **11. Destination Hub** | Quét nhận tại kho giao hàng cuối. |
| **8. Tài xế đi giao (Last-mile)** | **12. Out For Delivery** | Giao hàng chặng cuối (Last-mile). |
| **9. Giao thành công / Ký nhận** | **13. Delivered** | Hoàn thành giao hàng và thu hộ COD. |
| (COD đối soát trực tiếp khi giao thành công) | **14. Settlement COD** | **Nghiệp vụ mới**: Đối soát tài chính, nộp tiền COD và quyết toán giữa Courier -> Hub -> Tài chính. |

---

## 2. So Sánh Máy Trạng Thái Đơn Hàng / Bưu Gửi (Status State Machine)

Mô hình mới đề xuất một hệ thống trạng thái chi tiết hơn rất nhiều để phản ánh đúng quy trình vận hành thực tế.

| Trạng thái hiện tại (Scoped Slice) | Trạng thái đề xuất (Doanh Nghiệp Thực Tế) | Phân Tích Ảnh Hưởng Trạng Thái |
| :--- | :--- | :--- |
| (Không có nháp) | **Draft** | Trạng thái nháp của đơn hàng khi khách hàng đang điền thông tin. |
| **Created** / **Active** | **Created** | Đơn hàng đã được lưu hệ thống nhưng chưa xác nhận thanh toán/địa chỉ. |
| (Chuyển thẳng sang Active) | **Confirmed** | Đơn hàng đã hợp lệ, sẵn sàng để lấy hàng. |
| **Active** (Gom hàng) | **Awaiting Pickup** | Đơn hàng đã được gán cho tài xế thu gom, đang chờ lấy. |
| **Active** | **Picked Up** | Tài xế đã lấy hàng thành công từ người gửi. |
| **Active** (Tại kho gốc) | **At Origin Hub** | Bưu gửi đã được nhập kho trung chuyển gốc. |
| **Active** (Đang phân loại) | **Sorting** | Bưu gửi đang ở trạng thái phân loại băng tải/chia tuyến. |
| **Active** (Đang vận chuyển) | **In Transit** | Bưu gửi đang trên xe liên tỉnh di chuyển giữa các Hub. |
| **Active** (Tại kho đích) | **At Destination Hub** | Bưu gửi đã đến kho phát cuối chặng. |
| **Active** (Đi giao) | **Out For Delivery** | Tài xế chặng cuối đang mang bưu gửi đi giao. |
| **Complete** | **Delivered** | Đơn hàng hoàn thành giao và thu tiền (nếu có). |

---

## 3. Phân Tích Các Thực Thể Mới Bổ Sung

Quy trình mới yêu cầu mô hình hóa thêm các thực thể nghiệp vụ quan trọng:

1.  **Shipping Zone (Phân vùng giao hàng)**:
    *   *Nghiệp vụ*: Dùng để ánh xạ địa chỉ của Người gửi và Người nhận thành các Vùng (Zone) tương ứng (ví dụ: Nội tỉnh, Nội vùng, Liên vùng).
    *   *Ảnh hưởng*: Cần bảng dữ liệu quản lý các tuyến/phân vùng dựa trên mã bưu chính (Postal Code) hoặc Tỉnh/Thành phố nhằm cung cấp đầu vào cho bộ tính phí (`Calculate Shipping Fee`).
2.  **Shipping Fee (Cước phí vận chuyển)**:
    *   *Nghiệp vụ*: Tính toán dựa trên Khoảng cách (Zone) + Trọng lượng (Weight) + Thể tích (Volume) + Phụ phí dịch vụ.
    *   *Ảnh hưởng*: Cần một bảng `RateCard` (Bảng giá) động để đối chiếu tính cước trước khi khóa giá ở trạng thái `Confirmed`.
3.  **COD & Payment (Thu hộ & Thanh toán)**:
    *   *Nghiệp vụ*: Theo dõi dòng tiền. Thanh toán trước (Prepaid) hoặc Thu hộ khi nhận hàng (COD).
    *   *Ảnh hưởng*: Cần quản lý cấu trúc ví/công nợ tài xế và trạng thái thanh toán của đơn hàng (`Paid`, `Unpaid`, `Refunding`).
4.  **Delivery Attempt (Lần giao hàng)**:
    *   *Nghiệp vụ*: Ghi nhận chi tiết từng lần tài xế đi giao hàng nhưng không thành công (Lý do: Khách hẹn lại, Không liên lạc được, Khách từ chối nhận).
    *   *Ảnh hưởng*: Thực thể này rất quan trọng để thực thi **BR-04** (Tự động chuyển hoàn sau 3 lần giao thất bại). Nó cần lưu trữ lịch sử nỗ lực giao hàng liên kết với sự kiện quét lỗi giao hàng (`delivery_failed`).
5.  **Settlement COD (Quyết toán COD)**:
    *   *Nghiệp vụ*: Quy trình tài xế nộp tiền mặt thu hộ về Hub cuối ngày và Hub đối soát chuyển tiền về tài khoản doanh nghiệp.
    *   *Ảnh hưởng*: Cần thực thể quản lý giao dịch đối soát tài chính (`SettlementTransaction`), tránh thất thoát tiền mặt trong chuỗi cung ứng.

---

## 4. Đánh Giá Khả Thi Cho Thời Gian Triển Khai (16 ngày)

Việc chuyển từ quy trình tối giản (Level 2 - Scoped) sang quy trình doanh nghiệp thực tế đầy đủ mang lại cả lợi ích vận hành và rủi ro triển khai:

*   **Ưu điểm**: Mô hình hóa sát với thực tế, dễ dàng mở rộng và tích hợp với các hệ thống ERP/kế toán doanh nghiệp sau này. Tránh được việc phải tái cấu trúc lớn ở Phase sau.
*   **Rủi ro**: Việc thêm bước `Assign Driver`, `Pickup`, các trạng thái gom hàng (`Sorting`), đặc biệt là **Settlement COD** và quản lý **Delivery Attempt** chi tiết sẽ làm phình to số lượng bảng trong cơ sở dữ liệu và tăng gấp đôi số lượng sự kiện cần xử lý qua NATS JetStream. Điều này có thể làm chậm tiến độ nếu không quản lý tốt giới hạn nghiệp vụ (Service Boundaries).

**Khuyến nghị**: Chúng ta nên triển khai quy trình đề xuất này bằng cách giữ nguyên mô hình cơ sở dữ liệu phẳng của bưu gửi (không bổ sung thực thể lồng ghép như Bag/Manifest vật lý), đồng thời tinh giản phần **Settlement COD** ở mức lưu trạng thái giao dịch cơ bản thay vì xây dựng hệ thống kế toán đầy đủ.
