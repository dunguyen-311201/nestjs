# Task 5.1 Walkthrough — Order Service: entities, DTOs, order-creation logic

> Tài liệu giải thích tạm thời, viết để review task 5.1. Mỗi bước giải
> thích cái gì đã viết và tại sao viết như vậy, không chỉ liệt kê thay
> đổi. Từ ngữ chuyên ngành phổ biến (entity, decorator, abstract,
> interface, transaction, token...) giữ nguyên tiếng Anh, không dịch.
> File này archive/xoá sau khi bạn review xong — nó trùng lặp có chủ đích
> với `TASKS.md`/`docs/PROGRESS.md` (2 file đó ngắn gọn để tra cứu nhanh,
> còn file này để hiểu sâu).

Thứ tự commit: `b5a2abe` → `aff2516` → `103f158` → `c6b78b7` →
`95e2098` → `f338233` (trước đó là `759cb4c`, quyết định ADR-006 về dependency).

---

## Bước 1 — Entities (`b5a2abe`)

**Files:** `apps/order/src/entities/{customer,shipment-order,parcel}.entity.ts`, `parcel.enums.ts`, `shipment-order-status.enum.ts`

Entity trong TypeORM là một class thường có gắn decorator (`@Entity`,
`@Column`...) để map class đó vào một bảng DB, mỗi property vào một cột.

Vài điểm về syntax:

- `@Entity({ name: 'CUSTOMER' })` — tên bảng ghi rõ ràng (viết hoa) để
  khớp chính xác với `db/init-db.sql`, vì `synchronize: false` nghĩa là
  TypeORM không tự sinh schema — nó chỉ đọc/ghi vào bảng đã tồn tại sẵn.
- `@PrimaryGeneratedColumn('uuid')` — DB tự sinh id qua
  `DEFAULT gen_random_uuid()`, TypeORM chỉ cần biết đây là primary key
  và không tự chèn giá trị id của riêng nó.
- `@Column({ name: 'name_enc', type: 'varchar', length: 500 })` — option
  `name` dùng để map tên cột `snake_case` bên DB (`name_enc`) sang property
  `camelCase` bên class TypeScript (`nameEnc`). Việc mapping này lặp lại
  ở mọi cột.
- **Tại sao dùng `varchar` thường thay vì kiểu column `enum` của TypeORM**
  cho các cột `status`/`type`/`direction`/`state`: Postgres có 2 cách để
  giới hạn một cột chỉ nhận vài giá trị cố định — dùng kiểu `ENUM` gốc
  (native), hoặc dùng `VARCHAR` + ràng buộc `CHECK (col IN (...))`.
  `db/init-db.sql` đã chọn cách `CHECK` (xem dòng ~95, ~106-108). Option
  `enum:` của TypeORM lại sinh ra kiểu `ENUM` gốc của Postgres — nếu dùng
  sẽ không khớp với schema thật đang có. Vì vậy entity dùng
  `type: 'varchar'` bình thường, còn việc giới hạn giá trị chỉ nằm ở tầng
  ứng dụng qua TypeScript enum (`ShipmentOrderStatus`, `ParcelType`...)
  để có type-safety lúc code — ràng buộc thật ở tầng DB vẫn là `CHECK`,
  không đổi.
- `@ManyToOne(() => Customer) @JoinColumn({ name: 'sender_id' })` trên
  `ShipmentOrder` — đây là cách TypeORM diễn đạt "có một cột foreign key
  tên `sender_id`, và khi load một order lên, tôi có thể load luôn cả
  object `Customer` đầy đủ vào `.sender`." `@JoinColumn` chỉ cần khai báo
  ở phía "sở hữu" cột FK; bên `Customer` không cần khai báo chiều ngược
  lại vì task này chưa cần truy vấn "tất cả order của một customer."
- `route_id` trên `Parcel` là `nullable: true` và không có `@ManyToOne`
  — theo comment trong `db/init-db.sql` là `-- Logical FK to ROUTE.id`,
  đây là tham chiếu chéo service — Route thuộc về schema riêng của Hub
  Service. TypeORM không thể join xuyên schema/service, và convention
  của dự án (`docs/02-HLD.md` § Data Isolation) là không bao giờ dùng
  `FOREIGN KEY` thật ở tầng DB giữa các service khác nhau — nên đây chỉ
  là một cột `uuid` bình thường, việc validate để sau, do service nào
  tiêu thụ giá trị đó tự lo.

## Bước 2 — `CreateOrderDto` (`aff2516`)

**Files:** `apps/order/src/dto/create-order.dto.ts` (+ `.spec.ts`)

DTO (Data Transfer Object) là class mô tả/validate hình dạng của request
body gửi lên qua HTTP. Các decorator của `class-validator`
(`@IsString()`, `@IsNotEmpty()`, `@IsEnum()`, `@IsInt()`, `@Min(1)`) —
mỗi cái thêm một luật kiểm tra. `ValidationPipe` toàn cục của NestJS
(đã cấu hình sẵn cho cả project) tự động chạy hết các luật này trước khi
code trong controller chạy — controller sẽ không bao giờ thấy một body
không hợp lệ.

- `@ValidateNested()` + `@Type(() => AddressDto)` trên `sender`/`recipient`
  — mặc định `class-validator` chỉ validate property ở tầng ngoài cùng.
  Nếu `sender` bản thân nó là một object có luật riêng, `@ValidateNested()`
  báo cho nó biết phải đi sâu vào trong để chạy luôn luật của `AddressDto`.
  `@Type(() => AddressDto)` (đến từ `class-transformer`) cần thiết vì JSON
  gửi lên chỉ là object thường — `@Type` báo cho transformer phải tạo một
  instance thật của class `AddressDto` trước, để các decorator trên class
  đó có thứ để chạy lên.
- `@IsDefined()` được thêm cùng với `@ValidateNested()` sau khi lần chạy
  test đầu tiên (bước "red" của TDD) cho thấy trường hợp thiếu hẳn key
  `sender` lại không bị báo lỗi — vì `@ValidateNested()` chỉ validate
  những gì ở bên trong object nếu nó tồn tại, chứ không tự khẳng định
  object đó phải có mặt. Đây là một *gotcha* (bẫy nhỏ, dễ mắc phải mà
  không nhận ra ngay) khá phổ biến của `class-validator`.
- `@ArrayMinSize(1)` trên `parcels` áp luật "ít nhất một parcel" theo
  đúng bảng contract của `POST /orders` trong `docs/lld/order-service.md`.

Luồng TDD ở bước này: file `create-order.dto.spec.ts` được viết trước,
gồm 7 case (payload hợp lệ, thiếu sender, field rỗng, mảng rỗng, weight
sai, type sai, payment_type sai) và chạy thử — nó fail (bước "red") vì
`create-order.dto.ts` chưa tồn tại (`Cannot find module`). Sau đó mới
viết DTO cho đến khi cả 7 test pass (bước "green").

## Bước 3 — Ports (`103f158`)

**Files:** `apps/order/src/ports/{order-repository,pricing,idempotency-store}.port.ts`

"Port" ở đây chỉ là một `abstract class` (class trừu tượng, không có
implementation cụ thể) — nó tồn tại để tầng service chỉ phụ thuộc vào
một interface, chứ không phụ thuộc trực tiếp vào chi tiết cụ thể của
TypeORM/Redis/HTTP. Đây chính là pattern Ports & Adapters đã ghi trong
`docs/lld/00-conventions.md`. Ví dụ cụ thể:

```ts
export abstract class IOrderRepository {
  abstract createOrder(data: NewOrderData): Promise<ShipmentOrder>;
  abstract findById(id: string): Promise<ShipmentOrder | null>;
}
```

**Tại sao dùng `abstract class` mà không dùng `interface` của TypeScript?**
Dependency Injection (DI) của NestJS hoạt động bằng cách tra cứu một
token lúc runtime (có thể là class, string, hoặc symbol) — còn
`interface` thuần của TS thì không tồn tại lúc runtime (bị *erased*,
nghĩa là bị xoá hoàn toàn khi compile sang JS, không để lại dấu vết gì),
nên không thể dùng làm injection token được. Một `abstract class` thì
compile ra một class JS thật (dù không dùng trực tiếp được vì nó
abstract), nên dùng được làm token:
`{ provide: IOrderRepository, useClass: OrderRepository }`.

**Tại sao phải thêm một lớp gián tiếp này** thay vì inject thẳng
`OrderRepository`: để unit test của `OrderService`
(`order.service.spec.ts`) có thể truyền vào một object giả tự viết tay
(ví dụ `{ createOrder: jest.fn(), findById: jest.fn() }`) thay vì phải
có kết nối Postgres/Redis thật. Code của service không bao giờ import
`typeorm` hay `ioredis` trực tiếp — chỉ có các adapter mới làm việc đó.

## Bước 4 — Adapters + Repository (`c6b78b7`)

**Files:** `apps/order/src/adapters/{pricing-stub,redis-idempotency}.adapter.ts`, `apps/order/src/repositories/order.repository.ts`, cộng thêm `ioredis` được thêm vào `package.json`

Đây là phần implementation cụ thể cho các port ở bước trên.

- **`OrderRepository`** — nơi duy nhất import `DataSource` từ `typeorm`.
  `dataSource.transaction(async (manager) => {...})` gói 4 lệnh insert
  (Customer của sender, Customer của recipient, ShipmentOrder, Parcel[])
  vào một transaction DB duy nhất — hoặc tất cả các dòng cùng commit,
  hoặc không dòng nào commit cả, đúng với yêu cầu "ghi SHIPMENT_ORDER +
  PARCEL ... trong một transaction" của `docs/lld/order-service.md`.
- **`PricingStubAdapter`** — một placeholder có chủ đích. Pricing Service
  thật (task **5.4**, chưa xây) sẽ tra bảng `RATECARD` theo
  `(origin_zone_id, dest_zone_id, parcel_type)`. Vì bảng/logic đó chưa
  tồn tại, adapter này tạm trả về giá cố định theo từng loại parcel
  (`parcel` → 5000 cents, `pallet` → 20000 cents) và SLA cố định 3 ngày.
  Không cần sửa gì thêm ở chỗ khác khi task 5.4 thay thế cái này —
  `OrderModule` chỉ cần đổi
  `{ provide: IPricingPort, useClass: PricingStubAdapter }` sang class
  adapter thật.
- **`RedisIdempotencyAdapter`** — bọc `get`/`set` của `ioredis` đằng sau
  `IIdempotencyStore`. Đây là lý do `ioredis` được thêm làm dependency
  mới ở task này (đã được bạn duyệt, ghi lại ở
  `docs/adrs/ADR-006-redis-client-selection.md`).

## Bước 5 — `OrderService` (`95e2098`)

**Files:** `apps/order/src/order.service.ts` (+ `.spec.ts`)

Đây là business logic thật sự cho UC-02 (Create Order). Đọc
`order.service.ts` từ trên xuống:

1. **Kiểm tra idempotency trước tiên** — trước khi làm bất cứ gì, tra
   khoá `idem:order:{key}` trong store. Nếu tìm thấy, trả về response đã
   cache ngay lập tức (không gọi Pricing, không ghi DB) — đây chính là ý
   nghĩa cụ thể của "replay thay vì xử lý lại."
2. **Vòng lặp tính Price/SLA** — với từng parcel trong order, gọi
   `pricingPort.getPrice(originRegionCode, destRegionCode, parcelType)`.
   Nếu bất kỳ lần gọi nào trả về `null` (không có rate card khớp), throw
   `NotFoundException` ngay — cái này sẽ trở thành lỗi `404` theo
   contract. Ngược lại thì cộng dồn `totalPriceCents` (tổng giá qua các
   parcel) và giữ lại `slaExpectedDelivery` muộn nhất (worst-case,
   trường hợp xấu nhất) làm ETA chung của cả order. *(Luật "tổng + lấy
   max" này cho order có nhiều parcel không được nói rõ trong LLD — đây
   là cách hiểu hợp lý cho việc "SHIPMENT_ORDER chỉ có một field
   price_cents nhưng có thể chứa N parcel khác loại nhau," ghi chú lại ở
   đây phòng khi cần xem lại.)*
3. **Mã hoá PII** — hàm `encrypt()` từ `@app/crypto` (xây ở Phase 4)
   được gọi lên `name`/`phone`/`address` trước khi đưa cho repository,
   để dữ liệu PII dạng plaintext (chưa mã hoá) không bao giờ chạm tới
   tầng DB.
4. **Lưu** qua `orderRepository.createOrder(...)` — đây là lời gọi bị
   mock trong test, còn ở production thì là transaction thật.
5. **Cache lại kết quả**, rồi trả về.

Spec TDD (`order.service.spec.ts`) khởi tạo `OrderService` trực tiếp
bằng 3 object mock tự viết tay (không dùng `Test.createTestingModule`
của NestJS — không cần thiết vì đây là unit test thuần, không cần chạy
qua DI container thật). Test bao phủ: happy path (kiểm tra đúng
giá/rateCardId được truyền cho repository — đây chính là phần kiểm
chứng BR-01 "giá bị khoá"), Pricing trả về 404, replay khi trùng
Idempotency-Key (không gọi Pricing/repository lần nào), và ghi cache
sau khi thành công.

Một chi tiết nhỏ về test đáng biết: hàm `encrypt()` của `@app/crypto`
sẽ throw lỗi nếu `process.env.PII_ENCRYPTION_KEY` không phải chuỗi hex
64 ký tự, nên spec set `process.env.PII_ENCRYPTION_KEY = 'ab'.repeat(32)`
trong `beforeAll` — chỉ là key giả dùng cho test, dùng xong bỏ đi
(*throwaway*, không cần giữ lại), không liên quan gì tới bí mật thật.

## Bước 6 — Controller + Module wiring (`f338233`)

**Files:** `apps/order/src/order.controller.ts` (+ `.spec.ts`), `order.module.ts`, `apps/order/src/app.module.ts`

- **`OrderController`** cố tình viết mỏng (thin) — `create()` chỉ là
  một dòng, giao thẳng cho `orderService.createOrder(dto, idempotencyKey)`.
  Decorator `@IdempotencyKey()` (xây từ Phase 4,
  `libs/dtos/src/idempotency-key.decorator.ts`) tự lấy và kiểm tra
  header đó, tự throw lỗi `400` nếu thiếu — controller không cần viết
  logic riêng cho việc này.
- `quote()` gọi `pricingPort` trực tiếp (không đi qua `OrderService`) —
  vì theo `docs/lld/order-service.md`, `GET /orders/{id}/quote` được mô
  tả là "không lưu gì cả," chỉ là một bản xem trước đi thẳng qua, nên
  nếu route nó qua service tạo order sẽ chỉ tạo thêm một bước trung gian
  không cần thiết.
- **`OrderModule`** là nơi các port trừu tượng thực sự được gắn với
  class cụ thể — đây là file duy nhất nhìn vào là thấy hết toàn bộ
  wiring của Ports & Adapters:
  ```ts
  providers: [
    OrderService,
    { provide: IOrderRepository, useClass: OrderRepository },
    { provide: IPricingPort, useClass: PricingStubAdapter },
    { provide: IIdempotencyStore, useClass: RedisIdempotencyAdapter },
    { provide: REDIS_CLIENT, useFactory: () => new Redis({...}) },
  ],
  ```
- `app.module.ts` chỉ thêm đúng 1 dòng: 3 entity class mới được thêm
  vào lời gọi `TypeOrmModule.forRoot({ entities: [...] })` đã có sẵn,
  để TypeORM biết về chúng lúc khởi động. `OrderModule` cũng được import
  kèm theo.

---

## Tại sao chia commit theo cách này

Mỗi commit là một layer có thể review độc lập, theo đúng thứ tự phụ
thuộc — entities chưa ai phụ thuộc vào nên đứng đầu tiên; controller
phụ thuộc vào mọi thứ khác nên đứng cuối cùng. Cách chia này giúp bạn
review riêng từng câu hỏi: "mapping DB có đúng không?" tách biệt với
"business logic có đúng không?" tách biệt với "wiring có đúng không?" —
thay vì phải review cả 4 mối quan tâm trộn chung trong một diff.
