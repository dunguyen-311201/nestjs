# Business Rules — Scoped Slice

Rules are grouped by operational area. Each rule has an explicit enforcement point — a database constraint, service-layer logic, or a state-machine guard — so it maps directly to an implementation location, not just a policy statement.

(Renumbered sequentially. BR-08 was added when Stripe Payment was brought into scope; BR-09 was added when Notifications were brought into scope; see [docs/02-HLD.md](file:///home/dunguyen/Training/nestjs/shipping-system/docs/02-HLD.md).)

## Rule Catalogue

| ID | Rule Description | Operational Area | Enforcement Point |
| :--- | :--- | :--- | :--- |
| **BR-01** | Price is fixed via rate-card lookup and locked at order creation; changes are barred unless a weight discrepancy is flagged during hub ingestion. | Pricing | Service Logic |
| **BR-02** | A parcel may transition to `Out_for_Delivery` only after arriving at its destination hub. A wrong-hub scan blocks the transition, sets state to `Misrouted`, and triggers a corrective re-route instead. | Delivery / Routing | FSM State Guard |
| **BR-03** | The scan-event log is strictly append-only. Corrections are new compensating events — never an `UPDATE` or `DELETE` on an existing row. | Data Integrity | DB Insert-Only Partition |
| **BR-04** | After 3 failed delivery attempts, a parcel automatically enters Return-to-Sender: it keeps its original tracking ID, flips `direction = Reverse_RTS`, and the failed-attempt counter resets to zero for the reverse leg. | Exceptions | Service Logic |
| **BR-05** | `SHIPMENT_ORDER.status` is a materialized projection equal to the least-advanced status among its parcels, so no order stays `Active` indefinitely. Terminal states: `Complete`, `Partially_Delivered`, `Lost`, `Damaged`, `Cancelled`. | Order Lifecycle | Service Logic Aggregate |
| **BR-06** | A hub-measured weight that differs from the declared weight does not hold the parcel; the discrepancy is reconciled downstream (a post-delivery invoice/adjustment for prepaid). | Pricing / Ingestion | Service Logic + Audit Log |
| **BR-07** | Scan events that update an order projection are serialized per aggregate via a NATS JetStream per-order subject; event-batching debounces bursts so the projection is recomputed once per window. | Concurrency / Tracking | NATS JetStream (per-order subject) + ADR-001 |
| **BR-08** | An order cannot be dispatched for first-mile pickup, nor accepted at any hub inbound scan, until its Stripe payment is confirmed (`SHIPMENT_ORDER.status = Confirmed`). | Payment | Service Logic (`payment.succeeded` consumer) |
| **BR-09** | Key customer-facing lifecycle transitions (order confirmed, payment succeeded, delivered, RTS triggered) fire an asynchronous email notification. Notification delivery is best-effort: a failure to send never blocks, rolls back, or retries the triggering transaction. | Notifications | Stateless NATS Consumer |

## BR-05 Status Projection Mapping

BR-05 states the general principle ("least-advanced status among its parcels") but not the exact mapping from a `SHIPMENT_ORDER`'s set of `PARCEL.state` values to its own `status`. This table is the mapping the Order Service's projection consumer implements (task 5.6):

| Condition across the order's parcels | `SHIPMENT_ORDER.status` |
| :--- | :--- |
| At least one parcel is still non-terminal (`Created`, `InTransit`, `InHub`, `OutForDelivery`, `Misrouted`) | `Active` |
| All parcels are `Delivered` | `Complete` |
| All parcels are terminal (`Delivered`/`Lost`/`Damaged`) but not all `Delivered` (a mix) | `Partially_Delivered` |
| All parcels are `Lost` | `Lost` |
| All parcels are `Damaged` | `Damaged` |

`Draft`/`Created`/`Confirmed`/`Cancelled` are not produced by this projection — they sit outside the parcel-movement lifecycle (pre-payment, or a manual cancellation), so this recompute never sets them.

## Parcel Lifecycle (Happy Path)

1. Sender creates order → price locked (BR-01).
2. Sender completes Stripe checkout → payment verified via webhook, `SHIPMENT_ORDER.status = Confirmed` (BR-08). No pickup or hub inbound is accepted before this gate clears.
3. Courier first-mile pickup (motorbike) → origin hub.
4. Origin hub receives + re-weighs (BR-06).
5. Line-haul truck: depart → arrive at destination hub.
6. Destination hub inbound scan.
7. Courier last-mile delivery; proof of delivery is recorded.
8. Recipient receives + Proof of Delivery → order `Complete` (BR-05).

## Exception Branches

- **Payment not completed** → order stays blocked pre-dispatch; no pickup or hub inbound is accepted until `payment.succeeded` (BR-08).
- **Checkout abandoned** → the Stripe Checkout Session auto-expires (Stripe default 24h) with no completion; on `checkout.session.expired`, `SHIPMENT_ORDER.status` is auto-cancelled to `Cancelled` (only if still `Created` — a race with a completing webhook is a no-op), and `checkout()` can no longer be retried for that order (BR-08).
- **Failed delivery** ×3 → RTS, `direction = Reverse`, tracking ID kept (BR-04).
- **Misrouted** → wrong-hub scan → blocked + corrective re-route (BR-02).
- **Lost/Damaged** → terminal state → order `Partially_Delivered` (BR-05).

## Deferred (out of scope for this slice)

- **Post-delivery return** ("recipient receives, then later returns the parcel") is not modeled. BR-04's RTS path only triggers on 3 *failed* delivery attempts, never after a successful `Delivered`; `Delivered`/`Complete` remain terminal states. Supporting a return-after-delivery flow would require reopening these terminal states (or modeling the return as a new shipment order) plus a BR-04 revision — deferred until prioritized.

