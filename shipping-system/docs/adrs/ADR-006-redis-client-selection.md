# ADR-006: Redis Client Selection (ioredis vs. redis)

## Status

Accepted

## Context

To support REST API idempotency checks (verifying client-generated `Idempotency-Key` headers) and to cache hot read projections (e.g., serving `SHIPMENT_ORDER.status` queries under the 300ms P99 latency requirement), the microservices in the Domestic Parcel Shipping System require a Redis client library.

The selected library must satisfy the following criteria:
1.  **Seamless NestJS Integration**: Easily injectable as a NestJS provider/module across our monorepo microservices.
2.  **Resilience**: Robust automatic reconnection logic, offline queuing, and graceful error handling to prevent microservice crashes during transient Redis outages.
3.  **High Availability Compatibility**: Built-in support for Redis Sentinel and Redis Cluster topologies, allowing horizontal scaling in production without code changes.
4.  **Performance and Feature Set**: Support for pipelining, transactions (`MULTI`/`EXEC`), and execution of Lua scripts.

We evaluated the two main Node.js Redis clients:
*   **redis** (formerly `node-redis`, the legacy default Node client)
*   **ioredis** (a community-driven, feature-rich Redis client designed for performance and reliability)

## Decision

We choose **ioredis** as the standard Redis client library for the Domestic Parcel Shipping System, rejecting `redis`.

### Rationale

1.  **Robust Cluster and Sentinel Support**: `ioredis` has first-class, battle-tested support for Redis Cluster and Sentinel out of the box. In contrast, configuring cluster routing and failovers in `redis` is historically more complex and less mature.
2.  **Built-in Offline Queueing**: When the connection to Redis is lost, `ioredis` queues commands instead of failing them immediately (unless disabled). Once the connection is re-established, the queued commands are executed. This helps buffer transient network hiccup failures in microservice environments.
3.  **API Stability and async/await Native Design**: `ioredis` has offered a stable, promise-based API for years. `redis` underwent a massive, breaking rewrite in version 4, which caused integration friction and configuration drift in many NestJS and TypeORM environments.
4.  **NestJS Ecosystem Standard**: `ioredis` is the most common client used in advanced NestJS ecosystems (such as with BullMQ or specialized custom providers), making it easier to integrate, mock, and configure.

## Consequences

*   **Pros**:
    *   Stronger reliability during transient database disconnects due to the offline queue.
    *   Seamless transition from local standalone Redis to production Redis Cluster/Sentinel.
    *   Clean integration with NestJS async providers and dependency injection.
*   **Cons**:
    *   Adds a new third-party dependency (`ioredis` package) to the root `package.json`.
    *   Adds a minor overhead of package size, which is negligible for our backend container footprint.
