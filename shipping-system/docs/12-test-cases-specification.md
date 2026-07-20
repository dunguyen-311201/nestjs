# Specification Documents & E2E Test Cases for QA / Testers

Tài liệu này cung cấp danh sách kịch bản kiểm thử (Test Cases Specification) dành cho bộ phận Kiểm thử Chất lượng (QA/QC/Tester). Các kịch bản bao phủ toàn bộ luồng nghiệp vụ end-to-end từ lúc tạo đơn, thanh toán, vận chuyển qua các Hub, giao hàng, xử lý ngoại lệ đến việc kiểm tra bảo mật RBAC, Phân quyền tài nguyên (Ownership) và Chống trùng lặp (Idempotency).

---

## 🛠️ 1. Môi trường & Thiết lập Kiểm thử (Test Environment Setup)

### 1.1 Thông tin Kết nối (Endpoints)
* **API Gateway URL:** `http://localhost:3000` (Tất cả yêu cầu thử nghiệm của Tester đều qua Port 3000).
* **Nền tảng Xác thực (Auth):** Clerk JWT Session Token.
* **Header bắt buộc đối với API Gateway:**
  * `Authorization: Bearer <CLERK_JWT_TOKEN>` (Tất cả endpoint trừ `/health`, `/docs`, `/payments/webhook`).
  * `Content-Type: application/json`
  * `Idempotency-Key: <UNIQUE_UUID_OR_STRING>` (Bắt buộc đối với các yêu cầu `POST`).

### 1.2 Danh sách Tài khoản & Role Kiểm thử
Lấy Token từ giao diện Web Panel (`http://localhost:5173`) hoặc script tạo token thử nghiệm 1 giờ:

Giá trị `role` claim thật trong JWT là chữ thường snake_case (`libs/contracts/src/auth/role.ts`): `admin`, `shipper`, `hub_staff`, `dispatcher`, `customer`.

| Role (claim thật) | Email thử nghiệm | Mã Courier ID / User ID | Quyền hạn chính |
| :--- | :--- | :--- | :--- |
| **admin** | `admin.test@example.com` | `user_admin_01` | Toàn quyền truy cập tất cả API & bypass kiểm tra ownership |
| **shipper** (Courier 1) | `shipper.test@example.com` | `b578dcfe-...` | Thực hiện Pickup & Delivery các bưu kiện được phân công |
| **shipper** (Courier 2) | `courier2.test@example.com` | `c689edff-...` | Dùng để kiểm thử lỗi 403 Forbidden khi giao nhầm bưu kiện của Courier 1 |
| **customer** | `customer.test@example.com` | `user_cust_01` | Tạo đơn hàng, xem danh sách đơn của chính mình, tra cứu tracking |
| **hub_staff** | *(chưa có tài khoản seed sẵn — cần tạo trước khi chạy Suite 4)* | — | Quét nhập kho (`POST /hubs/:id/receive`) |
| **dispatcher** | *(chưa có tài khoản seed sẵn — cần tạo trước khi chạy Suite 5)* | — | Tạo/khởi hành/kết thúc chuyến line-haul (`/trips`) |

### 1.3 Dữ liệu Seed Sẵn có (Pre-seeded Master Data)
* **Origin Hub:** `Hub-REG-100` (Khu vực Hà Nội)
* **Destination Hub:** `Hub-REG-101` (Khu vực TP.HCM)
* **Route kết nối:** Đã có Route nối trực tiếp `Hub-REG-100` $\leftrightarrow$ `Hub-REG-101` (dùng đúng 2 mã region này khi tạo đơn để tránh dính lỗi BR-02 Misrouted).

---

## 📋 2. Ma trận Kịch bản Kiểm thử (Test Cases Matrix)

---

### 🟢 Suite 1: Quản lý Đơn hàng & Người gửi (Customer Order Management)

#### TC-ORD-001: Tạo đơn hàng thành công (Happy Path - PREPAID_STRIPE)
* **Mô tả:** Khách hàng (Customer) tạo một đơn hàng mới thanh toán trả trước.
* **Pre-conditions:** Token với Role `CUSTOMER`.
* **Steps:**
  ```bash
  curl -s -X POST http://localhost:3000/orders \
    -H "Authorization: Bearer <CUSTOMER_TOKEN>" \
    -H "Content-Type: application/json" \
    -H "Idempotency-Key: tc-ord-001-$(date +%s)" \
    -d '{
      "sender": {"name":"Alice","phone":"0900000001","address":"1 Alice St","region_code":"REG-100"},
      "recipient": {"name":"Bob","phone":"0911111112","address":"2 Bob St","region_code":"REG-101"},
      "parcels": [{"declared_weight_grams":500,"type":"parcel"}],
      "payment_type": "PREPAID_STRIPE"
    }'
  ```
* **Expected Result:**
  * HTTP Status: `201 Created`.
  * Response Body chứa `shipment_order_id`, `price_cents` (>0 được khóa từ RateCard), `expected_delivery_at`, `status: "Created"`.
  * Trong Database `shipping_order_db`: Bản ghi `shipment_orders` và `parcel` được tạo. Bản ghi `outbox` có trạng thái `PUBLISHED` trong vòng ~1s.

#### TC-ORD-002: Tạo đơn hàng thiếu `Idempotency-Key`
* **Mô tả:** Kiểm tra ràng buộc phải có header chống trùng.
* **Steps:** Thực hiện lại `POST /orders` nhưng KHÔNG truyền header `Idempotency-Key`.
* **Expected Result:**
  * HTTP Status: `400 Bad Request`.
  * Response Body báo lỗi thiếu header `Idempotency-Key`.

#### TC-ORD-003: Tạo đơn hàng thiếu thông tin PII bắt buộc
* **Mô tả:** Gửi thiếu SĐT hoặc Địa chỉ người nhận.
* **Steps:** Truyền `recipient.phone: ""` hoặc thiếu `region_code`.
* **Expected Result:**
  * HTTP Status: `400 Bad Request`.
  * Response Body chứa danh sách lỗi Validation DTO (`phone should not be empty`).

#### TC-ORD-004: Customer xem danh sách đơn hàng của chính mình (Phase 9.4 Ownership)
* **Mô tả:** Đảm bảo Customer chỉ xem được các đơn do mình tạo ra.
* **Steps:** 
  ```bash
  curl -s http://localhost:3000/orders -H "Authorization: Bearer <CUSTOMER_TOKEN>"
  ```
* **Expected Result:**
  * HTTP Status: `200 OK`.
  * Trả về danh sách đơn hàng mà `created_by_user_id` khớp với User ID của `<CUSTOMER_TOKEN>`. Không thấy đơn của khách hàng khác.

#### TC-ORD-005: Admin xem toàn bộ danh sách đơn hàng
* **Mô tả:** Admin xem danh sách đơn hệ thống mà không bị giới hạn ownership.
* **Steps:**
  ```bash
  curl -s http://localhost:3000/orders -H "Authorization: Bearer <ADMIN_TOKEN>"
  ```
* **Expected Result:**
  * HTTP Status: `200 OK`.
  * Trả về danh sách tất cả các đơn hàng trong hệ thống.

---

### 💳 Suite 2: Thanh toán & Checkout (Payment Service)

#### TC-PAY-001: Khởi tạo Stripe Checkout Session
* **Mô tả:** Tạo phiên thanh toán Stripe cho đơn hàng mới tạo.
* **Pre-conditions:** Đơn hàng ID từ `TC-ORD-001` ở trạng thái `Created`.
* **Steps:**
  ```bash
  curl -s -X POST http://localhost:3000/orders/<ORDER_ID>/checkout \
    -H "Authorization: Bearer <CUSTOMER_TOKEN>" \
    -H "Content-Type: application/json"
  ```
* **Expected Result:**
  * HTTP Status: `201 Created`.
  * Response Body chứa `checkout_url` (đường dẫn Stripe Checkout) và `stripe_session_id`.

#### TC-PAY-002: Giả lập Stripe Webhook Thanh toán Thành công
* **Mô tả:** Giả lập sự kiện Stripe gửi Webhook báo thanh toán hoàn tất.
* **Steps:** Bắn trực tiếp vào endpoint webhook (Endpoint công khai, không qua Bearer Token):
  ```bash
  curl -s -X POST http://localhost:3000/payments/webhook \
    -H "Content-Type: application/json" \
    -d '{
      "id": "evt_test_success",
      "type": "checkout.session.completed",
      "data": { "object": { "client_reference_id": "<ORDER_ID>", "payment_intent": "pi_123" } }
    }'
  ```
* **Expected Result:**
  * HTTP Status: `200 OK`.
  * Order Status chuyển từ `Created` $\rightarrow$ `Paid`.
  * Sự kiện `payment.succeeded` được publish lên NATS. `PAYMENT_TRANSACTION` trong DB lưu thông tin giao dịch.

#### TC-PAY-003: Kiểm tra Quy tắc BR-08 (Rào chắn Chưa thanh toán không được Pickup)
* **Mô tả:** Cố tình thực hiện quét Pickup đối với đơn hàng CHƯA thanh toán.
* **Pre-conditions:** Tạo đơn mới (`PREPAID_STRIPE`) nhưng chưa gọi Webhook thanh toán.
* **Steps:** Shipper thực hiện quét Pickup bưu kiện của đơn chưa thanh toán này.
* **Expected Result:**
  * HTTP Status: `422 Unprocessable Entity`.
  * Response Body: `BusinessRuleException` với code `BR-08`, message `"Parent order is not yet Confirmed - pickup is blocked until payment is confirmed"`. Áp dụng chung cho mọi order chưa `Confirmed`, không riêng `PREPAID_STRIPE`.

---

### 🚚 Suite 3: Nghiệp vụ Courier / Shipper (Pickup & Delivery)

#### TC-COU-001: Shipper Quét Pickup Bưu kiện
* **Mô tả:** Shipper lấy bưu kiện từ người gửi. `:id` trong path là **parcel id**.
* **Pre-conditions:** Đơn hàng đã thanh toán thành công (`Paid`).
* **Steps:**
  ```bash
  curl -s -X POST http://localhost:3000/couriers/parcels/<PARCEL_ID>/pickup \
    -H "Authorization: Bearer <SHIPPER_TOKEN>" \
    -H "Content-Type: application/json" \
    -H "Idempotency-Key: tc-cou-001-$(date +%s)" \
    -d '{"courier_id": "b578dcfe-..."}'
  ```
* **Expected Result:**
  * HTTP Status: `200 OK`.
  * Trạng thái Bưu kiện chuyển sang `Picked_Up`.
  * Event tương ứng được ghi vào `TrackingEvent`.
  * Cột `assigned_courier_id` trong bảng `PARCEL` được cập nhật gán cho Courier `b578dcfe-...` (Phase 10).

#### TC-COU-002: Shipper Giao bưu kiện được phân công (Happy Delivery)
* **Mô tả:** Shipper thực hiện giao bưu kiện đã được phân công thành công cho người nhận. `DeliverDto` là body phẳng (flat) — không có object `proof_of_delivery`, và `parcel_id` lấy từ URL, không truyền trong body.
* **Pre-conditions:** Bưu kiện đã trải qua các bước luân chuyển và được gán `assigned_courier_id` cho Shipper 1.
* **Steps:**
  ```bash
  curl -s -X POST http://localhost:3000/couriers/parcels/<ASSIGNED_PARCEL_ID>/deliver \
    -H "Authorization: Bearer <SHIPPER_1_TOKEN>" \
    -H "Content-Type: application/json" \
    -H "Idempotency-Key: tc-cou-002-$(date +%s)" \
    -d '{"courier_id": "b578dcfe-...", "outcome": "DELIVERED", "signature_url": "http://img.com/sig.jpg", "photo_url": "http://img.com/pod.jpg"}'
  ```
* **Expected Result:**
  * HTTP Status: `200 OK`.
  * Trạng thái Bưu kiện chuyển sang `Delivered`.
  * Lưu thông tin proof (`signature_url`, `photo_url`) vào Database.

#### TC-COU-003: Shipper Giao bưu kiện CỦA COURIER KHÁC (Phase 10 Ownership Guard)
* **Mô tả:** Shipper 2 cố tình gọi API giao bưu kiện đang được gán cho Shipper 1.
* **Steps:** Dùng `<SHIPPER_2_TOKEN>` để gọi endpoint `/deliver` đối với `<ASSIGNED_PARCEL_ID>` của Shipper 1.
* **Expected Result:**
  * HTTP Status: `403 Forbidden`.
  * Response Body: `"This parcel is not assigned to the calling courier"` (Khác với lỗi 422 lỗi nghiệp vụ, đây là lỗi vi phạm phân quyền 403).

#### TC-COU-004: Vi phạm State Machine (FSM Guard Test)
* **Mô tả:** Cố tình giao bưu kiện khi bưu kiện vừa tạo xong (chưa qua Pickup hay Inbound Hub).
* **Steps:** Gọi `/deliver` cho một bưu kiện vừa mới tạo ở trạng thái `Created`.
* **Expected Result:**
  * HTTP Status: `422 Unprocessable Entity`.
  * Response Body: Báo lỗi vi phạm FSM transition (`Invalid state transition from Created to Delivered`).

---

### 🏭 Suite 4: Xử lý tại Hub & Phân loại (Hub Sortation)

Chỉ có **một** route nhận bưu kiện tại Hub: `POST /hubs/:id/receive`, trong đó `:id` là **hub id** (UUID, path param — không truyền `hub_id`/`operator_id` trong body). Không có route "outbound scan" riêng biệt.

#### TC-HUB-001: Quét Nhập kho tại Hub Gốc (Receive Scan)
* **Mô tả:** Nhân viên Hub quét nhập kho bưu kiện sau khi Shipper mang về.
* **Pre-conditions:** Bưu kiện ở trạng thái `Picked_Up`.
* **Steps:**
  ```bash
  curl -s -X POST http://localhost:3000/hubs/<ORIGIN_HUB_ID>/receive \
    -H "Authorization: Bearer <HUB_STAFF_TOKEN>" \
    -H "Content-Type: application/json" \
    -d '{"parcel_id": "<PARCEL_ID>"}'
  ```
* **Expected Result:**
  * HTTP Status: `200 OK`.
  * Trạng thái Bưu kiện chuyển sang `Inbound_Hub`.

#### TC-HUB-002: (Đã gộp vào TC-HUB-001 — không có route outbound riêng)
* **Ghi chú:** Tài liệu bản trước liệt kê một route `/hubs/scan/outbound` không tồn tại trong code. Việc chuyển tiếp bưu kiện lên xe line-haul được xử lý qua Suite 5 (`POST /trips`, `/trips/:id/depart`) chứ không phải một scan riêng tại Hub.

#### TC-HUB-003: Quét Nhập kho Nhầm Hub (BR-02 Misrouted Guard Test)
* **Mô tả:** Cố tình quét nhập kho tại một Hub không nằm trên Route định tuyến của bưu kiện.
* **Steps:** Gọi `POST /hubs/<WRONG_HUB_ID>/receive` với `parcel_id` của một bưu kiện thuộc route khác.
* **Expected Result:**
  * HTTP Status: `200 OK` (**không phải lỗi** — hệ thống chấp nhận scan và tự xử lý ngoại lệ).
  * Hệ thống phát sự kiện `PARCEL_MISROUTED` cộng một sự kiện re-route sửa lại hành trình cho bưu kiện (BR-02), thay vì trả về lỗi 422.

---

### 🚛 Suite 5: Quản lý Chặng Xe & Chuyển vùng (Dispatcher & Line-haul)

#### TC-DIS-001: Dispatcher Tạo Chặng Xe Line-haul (Create Trip)
* **Mô tả:** Tạo chuyến xe nối từ Hub-REG-100 tới Hub-REG-101.
* **Steps:**
  ```bash
  curl -s -X POST http://localhost:3000/trips \
    -H "Authorization: Bearer <DISPATCHER_TOKEN>" \
    -H "Content-Type: application/json" \
    -d '{"origin_hub_id": "<ORIGIN_HUB_ID>", "dest_hub_id": "<DEST_HUB_ID>", "parcel_ids": ["<PARCEL_ID>"]}'
  ```
* **Expected Result:**
  * HTTP Status: `201 Created`.
  * Trả về `trip_id` và trạng thái `Scheduled`.

#### TC-DIS-002: Xe Khởi hành & Đến nơi (Depart & Arrive Trip)
* **Mô tả:** Báo xe xuất phát và báo xe cập bến Hub đích.
* **Steps:**
  1. Gọi `POST /trips/<TRIP_ID>/depart` $\rightarrow$ Trạng thái bưu kiện thuộc chuyến xe đổi thành `In_Transit`.
  2. Gọi `POST /trips/<TRIP_ID>/arrive` $\rightarrow$ Trạng thái bưu kiện đổi thành `Arrived_At_Hub`.
* **Expected Result:**
  * HTTP Status cả 2 call: `200 OK`.
  * `TrackingEvent` lưu trữ đầy đủ các mốc sự kiện di chuyển chặng xe.

---

### 🔍 Suite 6: Tra cứu Tracking & Read Projections

#### TC-TRK-001: Tra cứu Timeline Chi tiết Đơn hàng
* **Mô tả:** Kiểm tra timeline và trạng thái projection tổng hợp. Route param thực tế tên `:trackingId` (dùng shipment_order_id làm giá trị).
* **Steps:**
  ```bash
  curl -s http://localhost:3000/tracking/<SHIPMENT_ORDER_ID> | python3 -m json.tool
  ```
* **Expected Result:**
  * HTTP Status: `200 OK`.
  * Response chứa `status` tổng hợp ở top-level (ví dụ: `In_Transit` hoặc `Delivered`).
  * Mảng `parcels[]` — mỗi phần tử là một bưu kiện, và `timeline` nằm **lồng bên trong từng phần tử của `parcels[]`** (không phải mảng top-level), liệt kê lịch sử quét theo thứ tự thời gian tăng dần.

#### TC-TRK-002: Kiểm tra Tự động Tính toán Status Projection (BR-05)
* **Mô tả:** Đơn có 2 bưu kiện: Parcel 1 đã `Delivered`, Parcel 2 mới `Inbound_Hub`.
* **Expected Result:** `SHIPMENT_ORDER.status` tổng hợp phải là `Inbound_Hub` (trạng thái tiến bộ chậm nhất theo đúng BR-05).

---

### 🔐 Suite 7: Bảo mật Phân quyền (RBAC Matrix Verification)

#### TC-AUT-001: Truy cập API không có Token (Unauthenticated)
* **Mô tả:** Gọi bất kỳ API bảo vệ nào mà không truyền `Authorization` header.
* **Steps:** `GET /orders` không có header `Authorization`.
* **Expected Result:** `401 Unauthorized`.

#### TC-AUT-002: Customer cố tình truy cập API dành cho Courier/Hub
* **Mô tả:** Dùng Token Customer gọi API quét giao hàng `/couriers/parcels/<PARCEL_ID>/deliver`.
* **Expected Result:** `403 Forbidden`.

#### TC-AUT-003: Admin Bypass kiểm tra Ownership
* **Mô tả:** Admin gọi API giao bưu kiện hoặc xem đơn hàng của bất kỳ ai.
* **Expected Result:** `200 OK` (Admin có toàn quyền bypass mọi rào chắn ownership).

---

### 🔁 Suite 8: Kiểm thử Chống trùng lặp (Idempotency Verification)

#### TC-IDM-001: Duplicate HTTP POST Request với cùng `Idempotency-Key`
* **Mô tả:** Gửi liên tiếp 2 request `POST /orders` trùng hệt nhau về Payload và `Idempotency-Key`.
* **Expected Result:**
  * Request 1: `201 Created` (Tạo đơn mới).
  * Request 2: Trả về kết quả từ Cache hoặc `200/201` với thông tin đơn hàng đã tạo từ Request 1. **Không tạo thêm bản ghi trùng trong Database**.

#### TC-IDM-002: Re-publish NATS Event với cùng `Nats-Msg-Id`
* **Mô tả:** Giả lập NATS gửi lại event `order.created` trùng `event_id`.
* **Expected Result:** NATS Broker drop bản ghi trùng trong window 2 phút (`Nats-Msg-Id` header); Consumer nếu nhận được sau 2 phút vẫn tự chặn bằng ràng buộc unique trên `tracking_event.event_id` (TypeORM `.orIgnore()`, tương đương `ON CONFLICT DO NOTHING`), không sinh ra bưu kiện lặp.

---

## 📊 3. Báo cáo Kết quả Kiểm thử (Test Execution Report Template)

Tester sử dụng bảng biểu bên dưới để ghi nhận kết quả trong các đợt kiểm thử:

| Test Case ID | Tên Kịch bản | Role thực thi | Kết quả Mong đợi | Pass / Fail | Ghi chú / Ticket Bug |
| :--- | :--- | :--- | :--- | :--- | :--- |
| **TC-ORD-001** | Tạo đơn hàng Happy Path | CUSTOMER | HTTP 201, trả về Price & Status Created | [ ] Pass | |
| **TC-ORD-002** | Tạo đơn thiếu Idempotency-Key | CUSTOMER | HTTP 400 Bad Request | [ ] Pass | |
| **TC-ORD-004** | Customer xem danh sách đơn | CUSTOMER | HTTP 200, chỉ thấy đơn của mình | [ ] Pass | |
| **TC-PAY-003** | Pickup đơn chưa thanh toán | SHIPPER | HTTP 422, BR-08 | [ ] Pass | |
| **TC-COU-002** | Shipper giao đơn được phân công | SHIPPER 1 | HTTP 200, status Delivered | [ ] Pass | |
| **TC-COU-003** | Shipper giao đơn người khác | SHIPPER 2 | HTTP 403 Forbidden | [ ] Pass | |
| **TC-HUB-001** | Quét nhập kho tại Hub Gốc | hub_staff | HTTP 200, status Inbound_Hub | [ ] Pass | |
| **TC-AUT-001** | Gọi API không Token | Unauthenticated | HTTP 401 Unauthorized | [ ] Pass | |
| **TC-IDM-001** | Gửi trùng Idempotency-Key | CUSTOMER | Không sinh trùng đơn DB | [ ] Pass | |
