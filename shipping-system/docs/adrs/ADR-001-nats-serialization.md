# ADR-001: Per-Aggregate Serialization Via NATS JetStream

## Status
Proposed

## Context
When a large truck arrives at a delivery hub or a batch of parcels is processed at shift change, hundreds of scan events are fired in rapid succession. If multiple threads in the `order-service` consume these events concurrently to update the materialized `SHIPMENT_ORDER.status` projection for the same order, this will lead to database write contention, lock acquisition timeouts, and potential deadlock exceptions.

We need a way to ensure that all events belonging to the same `shipment_order_id` are processed sequentially (one after the other), while events for different orders can still be processed in parallel.

## Decision
We will use **NATS JetStream subject partitioning** to serialize processing on a per-aggregate (per-order) basis:

1.  Every status-relevant scan event will publish a lightweight recompute trigger to the subject: `shipment_orders.status.<shipment_order_id>`.
2.  The NATS consumer in `order-service` will subscribe to the wildcard subject `shipment_orders.status.>` using JetStream's ordered/serial delivery configuration per subject.
3.  Because NATS guarantees that messages published to the exact same subject are delivered in-order to the subscription, the consumer will process updates for a single `shipment_order_id` in sequence.
4.  No global mutex lock or database-level row locking (`SELECT FOR UPDATE`) is needed, keeping database latency low and avoiding deadlock conditions.

## Consequences
*   **Pros**:
    *   Eliminates concurrency issues and database locking overhead during high-volume hub inbound bursts.
    *   Preserves eventual consistency ordering automatically.
*   **Cons**:
    *   Requires proper configuration of the NATS JetStream stream to support wildcard routing (`shipment_orders.status.>`) and matching consumer parameters.
