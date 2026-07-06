# ADR-005: Message Broker Selection (NATS JetStream vs. Kafka / RabbitMQ)

## Status

Accepted

## Context

The Domestic Parcel Shipping System is designed as an event-driven NestJS microservices architecture. To support asynchronous communication, decoupling, and read-model projection generation, we require a reliable message broker/event backbone.

The selected technology must support:

1.  **Publish-Subscribe Semantics**: Allowing multiple services to consume the same event independently (e.g., `parcel.delivered` is consumed by Tracking, Order, and Notification services).
2.  **Durability and Delivery Guarantees**: Persisting messages to disk to support at-least-once delivery and explicit worker acknowledgments (`AckExplicit`).
3.  **Per-Aggregate Ordering**: Ensuring that events targeting the same aggregate (e.g., `order_id`) are processed sequentially to avoid database write contention and locks during high-frequency scans (as defined in [ADR-001](file:///home/dunguyen/Training/nestjs/shipping-system/docs/adrs/ADR-001-nats-serialization.md)).
4.  **Resource Efficiency**: Running comfortably on a local development machine alongside 7 NestJS services and a PostgreSQL database (reiterating the resource preservation goal of [ADR-003](file:///home/dunguyen/Training/nestjs/shipping-system/docs/adrs/ADR-003-shared-db-for-slice.md)).

We evaluated three primary message broker candidates:

- **RabbitMQ** (Traditional queue-based AMQP broker)
- **Apache Kafka** (Distributed log-based event streaming platform)
- **NATS JetStream** (Log-based streaming extension built on NATS Core)

## Decision

We choose **NATS JetStream** as the core message broker and event backbone for the Shipping System, rejecting Kafka and RabbitMQ.

### Rationale

1.  **NATS JetStream vs. Apache Kafka**:
    - _Ordering Mechanics_: Both systems support event streaming and ordering guarantees. Kafka uses partition keys (hashing `order_id` to a fixed number of partitions). However, Kafka requires pre-determining the partition count, and scaling partitions requires administrative re-sharding. NATS JetStream supports **subject-level ordering** (using wildcards like `orders.status.<order_id>`). This allows an infinite number of logical subjects to run concurrently with absolute order guarantees per subject, without managing partition counts.
    - _Resource Consumption_: Kafka is extremely heavy. It runs on the JVM and requires a cluster of ZooKeeper or KRaft metadata servers. This consumes gigabytes of memory, violating our local development constraint. NATS JetStream is written in Go, compiled into a single lightweight binary, and runs with a footprint of less than 50MB of RAM.
2.  **NATS JetStream vs. RabbitMQ**:
    - _Serialization Feasibility_: RabbitMQ is designed for competing-consumer work queues. Implementing per-aggregate ordering (sequential processing for the same `order_id`) in RabbitMQ is notoriously complex. It requires the RabbitMQ Consistent Hash Exchange plugin, or creating a separate queue per active order, which introduces severe database and memory overhead. NATS JetStream's subject-based routing resolves this out-of-the-box.
    - _Stream Model_: Although RabbitMQ introduced "Streams" in version 3.9, its ecosystem is still primarily queue-focused, and client library support for Streams in Node.js/NestJS is less mature compared to NATS JetStream's client.
3.  **NATS JetStream vs. NATS Core (Pub/Sub)**:
    - NATS Core operates as a fire-and-forget message bus. If a service is down during deployment or crashes, it misses events. NATS JetStream adds stream persistence, consumer offsets, and redelivery mechanisms (`max_deliver = 5` with backoff and DLQ mapping), fulfilling our durability requirement.

## Consequences

- **Pros**:
  - Extremely lightweight and fast (less than 50MB RAM footprint per broker instance).
  - Native support for wildcard subjects (e.g., `orders.status.>`) with in-subject ordering, eliminating the need for application-level distributed locks.
  - Simplified deployment (runs as a single Docker container).
  - Flexible consumer types (Pull consumers for service decoupling, Push consumers for simple event forwarding).
- **Cons**:
  - NestJS's built-in `@nestjs/microservices` NATS transporter only supports NATS Core. To use JetStream (with features like streams, pull consumers, and explicit ACKs), we must use the official `nats` npm package directly or implement a custom JetStream transporter wrapper.
  - Fewer standard dashboard tools for JetStream compared to RabbitMQ's web management console or Kafka's UI tools (rely on `nats` CLI tool for administration).
