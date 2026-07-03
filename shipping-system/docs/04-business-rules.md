# Business Rules — Scoped Slice

Rules are grouped by operational area. Each rule has an explicit enforcement point — a database constraint, service-layer logic, or a state-machine guard — so it maps directly to an implementation location, not just a policy statement.

(Renumbered sequentially after cutting the bag/manifest rules — no gaps. BR-08/BR-09 were added when Payment/COD were brought into scope; BR-10 was added when Notifications were brought into scope; see [docs/02-HLD.md](file:///home/dunguyen/Training/nestjs/shipping-system/docs/02-HLD.md).)

## Rule Catalogue

| ID | Rule Description | Operational Area | Enforcement Point |
| :--- | :--- | :--- | :--- |
| **BR-01** | Price is fixed via rate-card lookup and locked at order creation; changes are barred unless a weight discrepancy is flagged during hub ingestion. | Pricing | Service Logic |
| **BR-02** | A parcel may transition to `Out_for_Delivery` only after arriving at its destination hub. A wrong-hub scan blocks the transition, sets state to `Misrouted`, and triggers a corrective re-route instead. | Delivery / Routing | FSM State Guard |
| **BR-03** | The scan-event log is strictly append-only. Corrections are new compensating events — never an `UPDATE` or `DELETE` on an existing row. | Data Integrity | DB Insert-Only Partition |
| **BR-04** | After 3 failed delivery attempts, a parcel automatically enters Return-to-Sender: it keeps its original tracking ID, flips `direction = Reverse_RTS`, and the failed-attempt counter resets to zero for the reverse leg. | Exceptions | Service Logic |
| **BR-05** | `ORDER.status` is a materialized projection equal to the least-advanced status among its parcels, so no order stays `Active` indefinitely. Terminal states: `Complete`, `Partially_Delivered`, `Lost`, `Damaged`, `Cancelled`. | Order Lifecycle | Service Logic Aggregate |
| **BR-06** | A hub-measured weight that differs from the declared weight does not hold the parcel; the discrepancy is reconciled downstream (COD amount adjusted, or a post-delivery invoice for prepaid). | Pricing / Ingestion | Service Logic + Audit Log |
| **BR-07** | Scan events that update an order projection are serialized per aggregate via a NATS JetStream per-order subject; event-batching debounces bursts so the projection is recomputed once per window. | Concurrency / Tracking | NATS JetStream (per-order subject) + ADR-001 |
| **BR-08** | A prepaid order cannot be dispatched for first-mile pickup, nor accepted at any hub inbound scan, until its Stripe payment is confirmed (`ORDER.status = Confirmed`). COD orders are exempt from this guard. | Payment | Service Logic (`payment.succeeded` consumer) |
| **BR-09** | Cash collected by a courier on COD deliveries must be reconciled against that courier's end-of-shift deposit; a mismatch is flagged `Discrepancy` for manual review rather than silently accepted as `Settled`. | Payment / Settlement | Service Logic + Audit Log |
| **BR-10** | Key customer-facing lifecycle transitions (order confirmed, payment succeeded, delivered, RTS triggered) fire an asynchronous email notification. Notification delivery is best-effort: a failure to send never blocks, rolls back, or retries the triggering transaction. | Notifications | Stateless NATS Consumer |

## Parcel Lifecycle (Happy Path)

1. Sender creates order → price locked (BR-01).
2. *If prepaid:* sender completes Stripe checkout → payment verified via webhook, `ORDER.status = Confirmed` (BR-08).
3. Courier first-mile pickup (motorbike) → origin hub.
4. Origin hub receives + re-weighs (BR-06).
5. Line-haul truck: depart → arrive at destination hub.
6. Destination hub inbound scan.
7. Courier last-mile delivery; *if COD*, cash is collected and recorded on the proof of delivery.
8. Recipient receives + Proof of Delivery → order `Complete` (BR-05).
9. *If COD:* courier deposits collected cash at end of shift → reconciled against delivered COD total (BR-09).

## Exception Branches

- **Payment not completed** (prepaid) → order stays blocked pre-dispatch; no pickup or hub inbound is accepted until `payment.succeeded` (BR-08).
- **Failed delivery** ×3 → RTS, `direction = Reverse`, tracking ID kept (BR-04).
- **Misrouted** → wrong-hub scan → blocked + corrective re-route (BR-02).
- **Lost/Damaged** → terminal state → order `Partially_Delivered` (BR-05).
- **COD cash mismatch** → settlement marked `Discrepancy`, routed to manual review instead of auto-`Settled` (BR-09).
