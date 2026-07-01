# Business Rules — Scoped Slice

(Renumbered sequentially after cutting the bag/manifest rules — no gaps.)

- **BR-01**: Price is fixed via rate-card lookup and locked at order creation.
- **BR-02**: A parcel can only go Out_for_Delivery after arriving at the destination hub. If scanned at a wrong hub it enters Misrouted; a guard blocks the forward transition and emits a corrective re-routing event.
- **BR-03**: The scan log is append-only. Corrections are new compensating events, never updates/deletes.
- **BR-04**: After 3 failed delivery attempts a parcel goes Return-to-Sender: it keeps its original tracking ID and sets direction=Reverse; the routing engine uses direction + location to route it back to the sender (avoids infinite loops).
- **BR-05**: Order has terminal states (Active, Complete, Partially_Delivered, Lost, Damaged, Cancelled). ORDER.status = least-advanced status of its parcels, so no order stays Active forever.
- **BR-06**: If the hub-measured weight differs from the declared weight, the parcel continues (not held); the difference is reconciled downstream (COD adjusted, or a post-delivery invoice).
- **BR-07**: Scan events updating an order projection are serialized per aggregate via a NATS JetStream per-order subject; event-batching debounces the burst so the projection is recomputed once per window.

## Parcel lifecycle (happy path)

1. Sender creates order → price locked (BR-01)
2. Courier first-mile pickup (motorbike) → origin hub
3. Origin hub receives + re-weighs (BR-06)
4. Line-haul truck: depart → arrive at destination hub
5. Destination hub inbound scan
6. Courier last-mile delivery
7. Recipient receives + Proof of Delivery → order Complete (BR-05)

## Exception branches

- **Failed delivery** ×3 → RTS, direction=Reverse, keep tracking ID (BR-04)
- **Misrouted** → wrong-hub scan → blocked + corrective re-route (BR-02)
- **Lost/Damaged** → terminal state → order Partially_Delivered (BR-05)
