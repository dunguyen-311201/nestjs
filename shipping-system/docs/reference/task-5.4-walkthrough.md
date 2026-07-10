# Task 5.4 Walkthrough — Pricing Service: rate-card matrix + Order-to-Pricing sync

> Tài liệu giải thích tạm thời, viết để review task 5.4. Từ ngữ chuyên
> ngành phổ biến (entity, decorator, abstract, interface, transaction,
> token, enum...) giữ nguyên tiếng Anh, không dịch. File này archive/xoá
> sau khi bạn review xong.

Thứ tự commit: `2a188a9` (schema fix `sla_days` + ERD + seed regen) →
`27e0e41` (`Zone`/`RateCard` entities + `network` connection) → `cf874dc`
(`RateCardPricingAdapter` + wiring, xoá `PricingStubAdapter`).

Mục tiêu task: task 5.1 đã có `IPricingPort` nhưng dùng
`PricingStubAdapter` — trả về giá **cố định**, không đọc DB gì cả. Task
5.4 thay bằng adapter thật, tra bảng `RATECARD` (`shipping_pricing_db`).

---

## Bước 1 — Schema fix: thêm `sla_days` (`2a188a9`)

**Vấn đề:** `docs/01-ERD.md` mô tả `PARCEL.sla_expected_delivery` là
"computed from RATECARD lookup at order creation" — nhưng bảng
`RATECARD` (trước task này) không có cột nào để tính ra con số đó cả. Đây
là **lỗ hổng thật trong schema gốc**, không phải việc bị deferred —
confirm với user trước khi sửa (per `CLAUDE.md`'s decision-authority:
touching schema is a structural change).

**Fix:** thêm cột vào `db/init-db.sql`:
```sql
sla_days INT NOT NULL CHECK (sla_days > 0)
```
vào bảng `shipping_pricing_db.RATECARD`. Cập nhật `docs/01-ERD.md` khớp
theo, và sửa 1 mô tả cũ trong `docs/lld/pricing-service.md` nói rate card
"mutate-in-place, one row per lane × type" — thực ra sai, schema đã có
sẵn cột `effective_from`/`effective_to` (versioning theo thời gian, không
mutate-in-place) từ trước, doc chỉ chưa cập nhật theo.

**`generate_seed.py`:** thêm logic sinh `sla_days` ngẫu nhiên cho mỗi rate
card (2–5 ngày cho `parcel`, 4–7 ngày cho `pallet`), và sửa lại cách sinh
`expected_delivery_at` của mỗi order — trước đây là random 1–3 ngày
**không liên quan gì** đến rate card của order đó, giờ tính từ đúng
`sla_days` của rate card mà order đó match. Regenerate `db/seed.sql`.

## Bước 2 — `Zone` entity + `network` connection (`27e0e41`)

**Vấn đề tích hợp:** `RATECARD` key theo `(origin_zone_id, dest_zone_id,
parcel_type)` — nhưng `POST /orders`'s `sender`/`recipient` chỉ có
`region_code` (xem `CreateOrderDto`/`AddressDto` từ task 5.1). Bảng
`ZONE` (map `region_code → zone_id`) thuộc về Hub/Sortation Service
(`shipping_network_db`), mà Hub Service **chưa được build** (task 6.2).

**Giải pháp đã confirm với user:** thêm 1 entity **read-only**:

```ts
// apps/order/src/entities/zone.entity.ts
@Entity({ name: 'zone' })
export class Zone {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ name: 'region_code', type: 'varchar', length: 50 })
  regionCode: string;
}
```

— và một **named TypeORM connection thứ 3** tên `'network'` (song song
với connection mặc định `order` dùng cho `shipping_order_db`, và
connection `'pricing'` cho `shipping_pricing_db`), trỏ tới
`shipping_network_db`. Order/Pricing **chỉ đọc** bảng này để resolve
`region_code → zone_id`, không bao giờ ghi — Hub Service (task 6.2) vẫn
là chủ sở hữu duy nhất/writer duy nhất của `ZONE`.

**Vì sao không đổi `IPricingPort`/`CreateOrderDto`:** giải pháp này giữ
nguyên contract có sẵn (`IPricingPort.getPrice(originRegionCode,
destRegionCode, parcelType)` vẫn nhận `region_code`, không đổi sang
`zone_id`) — việc resolve zone là chi tiết cài đặt **bên trong**
adapter, không rò rỉ ra interface. Nghĩa là code task 5.1 (service,
controller, DTO) **không cần sửa gì**.

`RateCard` entity cũng thêm ở bước này (map đúng field-for-field với
`db/init-db.sql`'s `RATECARD`, gồm cả `sla_days` mới thêm ở bước 1):

```ts
@Entity({ name: 'ratecard' })
export class RateCard {
  @PrimaryGeneratedColumn('uuid') id: string;
  @Column({ name: 'origin_zone_id', type: 'uuid' }) originZoneId: string;
  @Column({ name: 'dest_zone_id', type: 'uuid' }) destZoneId: string;
  @Column({ name: 'parcel_type', type: 'varchar', length: 50 }) parcelType: ParcelType;
  @Column({ name: 'price_cents', type: 'int' }) priceCents: number;
  @Column({ name: 'sla_days', type: 'int' }) slaDays: number;
  @Column({ name: 'effective_from', type: 'timestamp' }) effectiveFrom: Date;
  @Column({ name: 'effective_to', type: 'timestamp', nullable: true }) effectiveTo: Date | null;
  // + createdAt/updatedAt
}
```

## Bước 3 — `RateCardPricingAdapter` (`cf874dc`)

**File:** `apps/order/src/adapters/rate-card-pricing.adapter.ts`

```ts
@Injectable()
export class RateCardPricingAdapter implements IPricingPort {
  constructor(
    @InjectRepository(Zone, 'network') private readonly zoneRepository: Repository<Zone>,
    @InjectRepository(RateCard, 'pricing') private readonly rateCardRepository: Repository<RateCard>,
  ) {}

  async getPrice(originRegionCode, destRegionCode, parcelType): Promise<PriceQuote | null> {
    // 1. resolve cả 2 region_code -> zone_id song song
    const [originZone, destZone] = await Promise.all([...]);
    if (!originZone || !destZone) return null;   // 404 case #1

    // 2. query RATECARD đang "effective" tại thời điểm now
    const rateCard = await this.rateCardRepository.findOne({
      where: [
        { ...match, effectiveFrom: LessThanOrEqual(now), effectiveTo: MoreThan(now) },
        { ...match, effectiveFrom: LessThanOrEqual(now), effectiveTo: IsNull() },
      ],
    });
    if (!rateCard) return null;                  // 404 case #2

    // 3. tính ETA = now + sla_days
    const slaExpectedDelivery = new Date(now);
    slaExpectedDelivery.setUTCDate(slaExpectedDelivery.getUTCDate() + rateCard.slaDays);

    return { rateCardId: rateCard.id, priceCents: rateCard.priceCents, slaExpectedDelivery };
  }
}
```

Giải thích từng phần:

- **`@InjectRepository(Zone, 'network')`** — tham số thứ 2 của
  `@InjectRepository` chỉ định **connection name**, không phải connection
  mặc định. Đây là cách TypeORM (qua `@nestjs/typeorm`) cho phép 1
  service cùng lúc query nhiều schema/database khác nhau qua nhiều
  `DataSource` riêng biệt (per ADR-002/ADR-003) mà không cần tự quản lý
  connection pool thủ công.
- **`Promise.all([...])`** — resolve `originZone` và `destZone` song song
  (2 query độc lập, không phụ thuộc nhau), nhanh hơn resolve tuần tự.
- **`where: [ {...}, {...} ]`** — TypeORM cú pháp OR: mảng 2 object nghĩa
  là "match điều kiện 1 **hoặc** điều kiện 2." Ở đây cần vì "rate card
  đang hiệu lực" có 2 dạng: (a) có `effective_to` và `now` còn nằm trong
  khoảng, hoặc (b) `effective_to` là `NULL` (chưa có ngày hết hạn, hiệu
  lực vô thời hạn). Không viết gộp thành 1 điều kiện được vì so sánh với
  `NULL` cần toán tử khác (`IsNull()`) chứ không dùng `MoreThan(now)`
  được (SQL: `NULL > now` luôn là `NULL`/false, không phải `true`).
- **`return null`** ở cả 2 chỗ fail — không throw exception ở tầng
  adapter. `IPricingPort`'s contract (từ task 5.1) đã định nghĩa "không
  tìm ra giá" = trả `null`, để tầng service (`OrderService`) tự quyết
  định map `null` → HTTP `404` (giữ business-logic mapping ở service
  layer, adapter chỉ lo truy vấn data).
- **`setUTCDate(...)`** — dùng UTC method (không phải `setDate()` thường)
  vì `CLAUDE.md`'s convention: "Timestamps = UTC" xuyên suốt hệ thống,
  tránh lệch giờ theo timezone của máy chạy code.

**Wiring:** `order.module.ts` đổi từ bind `IPricingPort` →
`PricingStubAdapter` (task 5.1) sang bind → `RateCardPricingAdapter`.
`PricingStubAdapter` bị **xoá hẳn** (không giữ lại làm fallback/dead
code) vì không còn ai dùng.

### TDD

4 test mới trong `rate-card-pricing.adapter.spec.ts`:
1. Happy path — cả 2 zone resolve được, có rate card khớp, trả đúng
   `{ rateCardId, priceCents, slaExpectedDelivery }`.
2. `region_code` không resolve được → `null`.
3. Cả 2 zone resolve được nhưng không có rate card nào khớp
   `(origin_zone_id, dest_zone_id, parcel_type)` → `null`.
4. Query có đúng điều kiện `effective_from`/`effective_to` (đảm bảo
   không trả về 1 rate card đã hết hạn hoặc chưa tới ngày hiệu lực).

Viết và confirm red trước khi code adapter thật. 67/67 test tổng cộng
pass; `pnpm build`/`pnpm lint` sạch.

---

## Cách tự chạy test / thử nghiệm (test around)

Khác task 5.2/5.3, task này **có** REST endpoint thật (`POST /orders`,
`GET /orders/:id/quote` — build từ task 5.1, giờ trả giá **thật** thay
vì giá cố định của stub) và **có** đụng DB thật — nên đã live-verify,
không chỉ chạy unit test.

### Cách 1 — unit test

```bash
pnpm test apps/order/src/adapters/rate-card-pricing.adapter.spec.ts
```

### Cách 2 — chạy app thật + curl (đã tự làm, verify trước khi ghi vào đây)

```bash
# reseed sạch từ đầu để chắc chắn dữ liệu khớp generate_seed.py mới
docker compose down -v && docker compose up -d
# (chờ Postgres/Redis healthy, rồi seed lại theo scripts/verify-local.sh)

PII_ENCRYPTION_KEY=<key> npx nest start order
```

```bash
curl -X POST http://localhost:<port>/orders \
  -H 'Content-Type: application/json' \
  -H 'Idempotency-Key: <uuid>' \
  -d '{
    "sender": { "regionCode": "REG-100", ... },
    "recipient": { "regionCode": "REG-101", ... },
    "parcels": [{ "type": "parcel", ... }]
  }'
```

Kết quả xác nhận: trả đúng giá `2809` cents + ETA 2 ngày (khớp seed data
thật của lane `REG-100 -> REG-101`, không còn là `5000`/3-ngày cố định
của `PricingStubAdapter` cũ). Thử thêm 1 lane khác (loại `pallet`) qua
`GET /orders/:id/quote` — ra `8204` cents / 6-ngày, cũng khớp seed. Thử
`region_code` không tồn tại → đúng `404`. Đã kiểm tra thêm bằng cách
query trực tiếp DB (`psql`) để đối chiếu số liệu, không chỉ tin response
HTTP.

---

## Vì sao chia làm 3 commit

1. `2a188a9` — thay đổi **schema** (`sla_days` + ERD + seed regen): tách
   riêng vì đây là 1 loại thay đổi khác hẳn (migration/data), review cần
   nhìn riêng để đánh giá "schema fix này có đúng không" tách khỏi logic
   code.
2. `27e0e41` — entity + connection mới (`Zone`, `RateCard`, `network`
   DataSource config): hạ tầng cần có **trước** khi adapter dùng được
   chúng.
3. `cf874dc` — adapter thật + wiring + xoá stub: phần logic nghiệp vụ
   chính, phụ thuộc cả 2 commit trước.

Cùng pattern với lý do tách commit ở task 5.1/5.2 — mỗi commit review
được độc lập, đúng thứ tự phụ thuộc.
