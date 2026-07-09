# Task 5.1 Walkthrough — Order Service: entities, DTOs, order-creation logic

> Temporary, step-by-step explainer for reviewing task 5.1. Written for
> someone who may not be fluent in every TypeORM/NestJS/class-validator
> idiom used — each step explains **what** was written and **why**, not
> just what changed. Archive or delete once reviewed; it duplicates
> `TASKS.md`/`docs/PROGRESS.md`'s terser log entries on purpose (those are
> for recall, this one is for understanding).

Commits, in order: `b5a2abe` → `aff2516` → `103f158` → `c6b78b7` →
`95e2098` → `f338233` (preceded by `759cb4c`, the ADR-006 dependency
decision).

---

## Step 1 — Entities (`b5a2abe`)

**Files:** `apps/order/src/entities/{customer,shipment-order,parcel}.entity.ts`, `parcel.enums.ts`, `shipment-order-status.enum.ts`

TypeORM entities are plain classes with decorators that map each class to
a DB table and each property to a column. A few syntax notes:

- `@Entity({ name: 'CUSTOMER' })` — table name is explicit (uppercase) to
  match `db/init-db.sql` exactly, since `synchronize: false` means
  TypeORM never generates schema — it just needs to *read/write* the
  table that already exists.
- `@PrimaryGeneratedColumn('uuid')` — the DB's `DEFAULT gen_random_uuid()`
  generates the id, TypeORM just knows to treat it as the PK and not try
  to insert its own value.
- `@Column({ name: 'name_enc', type: 'varchar', length: 500 })` — the
  `name` option maps the DB's `snake_case` column to a `camelCase` class
  property (`nameEnc`), because TS/JS convention is camelCase but the SQL
  schema uses snake_case. This mapping happens at every column.
- **Why plain `varchar` instead of TypeORM's `enum` column type** for
  `status`/`type`/`direction`/`state`: Postgres has two ways to constrain
  a column to a fixed set of values — a native `ENUM` type, or a
  `VARCHAR` + `CHECK (col IN (...))` constraint. `db/init-db.sql` already
  uses the `CHECK` approach (see line ~95, ~106-108). TypeORM's `enum:`
  column option generates a native Postgres `ENUM` type, which would be a
  mismatch against the real schema. So the entities use plain
  `type: 'varchar'` and rely on a **TypeScript enum** (`ShipmentOrderStatus`,
  `ParcelType`, etc.) purely at the application layer for type-safety —
  the DB-level constraint is still the `CHECK`, unchanged.
- `@ManyToOne(() => Customer) @JoinColumn({ name: 'sender_id' })` on
  `ShipmentOrder` — this is TypeORM's way of saying "there's a foreign
  key column `sender_id`, and when I load an order, I can optionally
  populate a full `Customer` object under `.sender`." The `@JoinColumn`
  is only needed on the "owning" side (the side that actually has the FK
  column); `Customer` itself has no back-reference because nothing in
  this task needs to query "all orders for a customer" yet.
- `route_id` on `Parcel` is `nullable: true` and has **no** `@ManyToOne`
  — per `db/init-db.sql`'s comment `-- Logical FK to ROUTE.id`, this is a
  cross-service reference (Route belongs to Hub Service's own schema).
  TypeORM can't join across schemas/services, and the project's
  convention (`docs/02-HLD.md` § Data Isolation) is to never use a DB
  `FOREIGN KEY` across service boundaries anyway — it's just a plain
  `uuid` column, validated later by whichever service consumes it.

## Step 2 — `CreateOrderDto` (`aff2516`)

**Files:** `apps/order/src/dto/create-order.dto.ts` (+ `.spec.ts`)

A DTO (Data Transfer Object) is the class that describes/validates the
shape of an incoming HTTP request body. `class-validator` decorators
(`@IsString()`, `@IsNotEmpty()`, `@IsEnum()`, `@IsInt()`, `@Min(1)`) each
add one validation rule; NestJS's global `ValidationPipe` (already
configured project-wide) runs all of them automatically before the
controller method executes — the controller never sees an invalid body.

- `@ValidateNested()` + `@Type(() => AddressDto)` on `sender`/`recipient`
  — by default `class-validator` only validates *top-level* properties.
  If `sender` is itself an object with its own required fields,
  `@ValidateNested()` tells it to recurse into `AddressDto`'s own rules.
  `@Type(() => AddressDto)` (from `class-transformer`) is needed because
  incoming JSON is just a plain object — `@Type` tells the transformer
  to actually instantiate an `AddressDto` class instance first, so the
  decorators on that class have something to run against.
- `@IsDefined()` was added *in addition to* `@ValidateNested()` after the
  first test run (TDD "red" step) showed that a **missing** `sender` key
  entirely wasn't being flagged — `@ValidateNested()` only validates
  what's *inside* the object if it exists, it doesn't assert the object
  itself is present. This is a common class-validator gotcha.
- `@ArrayMinSize(1)` on `parcels` enforces "at least one parcel" per the
  `POST /orders` contract table in `docs/lld/order-service.md`.

The TDD flow here: `create-order.dto.spec.ts` was written first with 7
cases (valid payload, missing sender, empty fields, empty array, bad
weight, bad type, bad payment_type) and run — it failed because
`create-order.dto.ts` didn't exist yet (`Cannot find module`). Then the
DTO was implemented until all 7 passed.

## Step 3 — Ports (`103f158`)

**Files:** `apps/order/src/ports/{order-repository,pricing,idempotency-store}.port.ts`

A "port" here is just an `abstract class` with no implementation — it
exists purely so the service layer can depend on *an interface*, not a
concrete TypeORM/Redis/HTTP detail. This is the **Ports & Adapters**
pattern documented in `docs/lld/00-conventions.md`. Concretely:

```ts
export abstract class IOrderRepository {
  abstract createOrder(data: NewOrderData): Promise<ShipmentOrder>;
  abstract findById(id: string): Promise<ShipmentOrder | null>;
}
```

Why an `abstract class` and not a TypeScript `interface`? NestJS's
dependency injection works by looking up a *token* at runtime (a class,
string, or symbol) — plain TS `interface`s don't exist at runtime (they're
erased during compilation), so they can't be used as an injection token.
An `abstract class` compiles to a real (if unusable-on-its-own) JS class,
so it *can* be used as a token: `{ provide: IOrderRepository, useClass: OrderRepository }`.

The **why bother** with this indirection at all (rather than injecting
`OrderRepository` directly): so `OrderService`'s unit tests
(`order.service.spec.ts`) can pass in a hand-written fake object
(`{ createOrder: jest.fn(), findById: jest.fn() }`) instead of needing a
real Postgres/Redis connection. The service code never imports
`typeorm` or `ioredis` directly — only the adapters do.

## Step 4 — Adapters + Repository (`c6b78b7`)

**Files:** `apps/order/src/adapters/{pricing-stub,redis-idempotency}.adapter.ts`, `apps/order/src/repositories/order.repository.ts`, plus `ioredis` added to `package.json`

These are the concrete implementations of the ports above.

- **`OrderRepository`** — the only place that imports `DataSource` from
  `typeorm`. `dataSource.transaction(async (manager) => {...})` wraps the
  three inserts (sender `Customer`, recipient `Customer`, `ShipmentOrder`,
  `Parcel[]`) in **one DB transaction** — either all rows commit or none
  do, satisfying `docs/lld/order-service.md`'s "writes SHIPMENT_ORDER +
  PARCEL... in one DB transaction" requirement.
- **`PricingStubAdapter`** — a deliberate placeholder. The real Pricing
  Service (task **5.4**, not yet built) looks up a `RATECARD` row by
  `(origin_zone_id, dest_zone_id, parcel_type)`. Since that table/logic
  doesn't exist yet, this adapter just returns a fixed price per parcel
  type (`parcel` → 5000 cents, `pallet` → 20000 cents) and a fixed
  3-day SLA. **Nothing else in the codebase needs to change** when task
  5.4 replaces this — `OrderModule` just swaps
  `{ provide: IPricingPort, useClass: PricingStubAdapter }` for the real
  adapter class.
- **`RedisIdempotencyAdapter`** — wraps `ioredis`'s `get`/`set` behind
  `IIdempotencyStore`. This is why `ioredis` was added as a new
  dependency this task (approved, documented in
  `docs/adrs/ADR-006-redis-client-selection.md`).

## Step 5 — `OrderService` (`95e2098`)

**Files:** `apps/order/src/order.service.ts` (+ `.spec.ts`)

This is the actual business logic for UC-02 (Create Order). Reading
`order.service.ts` top to bottom:

1. **Idempotency check first** — before doing anything else, look up
   `idem:order:{key}` in the store. If found, return the cached response
   immediately (no Pricing call, no DB write) — this is what "replay
   instead of reprocessing" means concretely.
2. **Price/SLA loop** — for *each* parcel in the order, call
   `pricingPort.getPrice(originRegionCode, destRegionCode, parcelType)`.
   If any call returns `null` (no matching rate card), throw
   `NotFoundException` immediately — this becomes a `404` per the
   contract. Otherwise accumulate `totalPriceCents` (sum across parcels)
   and track the **latest** (worst-case) `slaExpectedDelivery` as the
   order's single ETA. *(This "sum + max" rule for multi-parcel orders
   isn't spelled out explicitly in the LLD — it's a reasonable reading of
   "SHIPMENT_ORDER has one price_cents field but can contain N parcels of
   different types," flagged here in case it needs revisiting.)*
3. **Encrypt PII** — `encrypt()` from `@app/crypto` (built in Phase 4) is
   called on `name`/`phone`/`address` before they're ever handed to the
   repository, so plaintext PII never reaches the DB layer.
4. **Persist** via `orderRepository.createOrder(...)` — this is the
   mocked call in tests, the real transaction in production.
5. **Cache the result**, then return it.

The TDD spec (`order.service.spec.ts`) constructs `OrderService` directly
with 3 hand-written mock objects (no NestJs `Test.createTestingModule` —
not needed for a plain unit test with no DI container behavior to
exercise) and covers: happy path (asserts the exact price/rateCardId
passed to the repository — this is the BR-01 "price locked" check),
Pricing-404, idempotent replay (no Pricing/repository calls at all), and
cache-write-after-success.

One test-infra detail worth knowing: `@app/crypto`'s `encrypt()` throws
if `process.env.PII_ENCRYPTION_KEY` isn't a 64-character hex string, so
the spec sets `process.env.PII_ENCRYPTION_KEY = 'ab'.repeat(32)` in a
`beforeAll` — a throwaway test key, unrelated to any real secret.

## Step 6 — Controller + Module wiring (`f338233`)

**Files:** `apps/order/src/order.controller.ts` (+ `.spec.ts`), `order.module.ts`, `apps/order/src/app.module.ts`

- **`OrderController`** is intentionally thin — `create()` is a
  one-line delegation to `orderService.createOrder(dto, idempotencyKey)`.
  The `@IdempotencyKey()` decorator (built in Phase 4,
  `libs/dtos/src/idempotency-key.decorator.ts`) extracts and validates
  the header, throwing `400` if it's missing — the controller doesn't
  need its own logic for that.
- `quote()` calls `pricingPort` **directly** (not through
  `OrderService`) — per `docs/lld/order-service.md`, `GET /orders/{id}/quote`
  is described as "nothing persisted," a pure passthrough preview, so
  routing it through the order-creation service would add an unnecessary
  hop.
- **`OrderModule`** is where the abstract ports actually get bound to
  concrete classes — this is the one file where you can see the whole
  Ports & Adapters wiring at a glance:
  ```ts
  providers: [
    OrderService,
    { provide: IOrderRepository, useClass: OrderRepository },
    { provide: IPricingPort, useClass: PricingStubAdapter },
    { provide: IIdempotencyStore, useClass: RedisIdempotencyAdapter },
    { provide: REDIS_CLIENT, useFactory: () => new Redis({...}) },
  ],
  ```
- `app.module.ts` gained one line: the three new entity classes added to
  the existing `TypeOrmModule.forRoot({ entities: [...] })` call, so
  TypeORM knows about them at bootstrap. `OrderModule` is imported
  alongside it.

---

## Why the commits are split this way

Each commit is one reviewable layer, in dependency order (entities have
no dependents yet, so they come first; the controller depends on
everything else, so it comes last). This makes it possible to review
"does the DB mapping look right?" independently from "does the business
logic look right?" independently from "is the wiring correct?" — rather
than reviewing all four concerns mixed into a single diff.
