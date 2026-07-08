# ADR-003: Shared PostgreSQL Instance with Schema-per-Service Isolation

## Status
Accepted

## Context
A strict microservices architecture requires each service to have its own independent database to ensure high availability and prevent cross-service database coupling. However, running 5 separate PostgreSQL database instances (or container instances) on a local machine for development consumes substantial RAM and CPU resources. We need a solution that preserves logical database boundaries while optimizing local system resource usage during the MVP phase.

## Decision
We will use a **single PostgreSQL database instance** in Docker, but configure it with **isolated schemas** (`shipping_order_db`, `shipping_tracking_db`, `shipping_courier_db`, `shipping_pricing_db`, `shipping_network_db`) representing each service's bounded context:

1.  **Logical Isolation**: Each microservice is strictly restricted to reading and writing only its designated schema (configured via TypeORM's `schema` property).
2.  **No Cross-Schema Joins/FKs**: Cross-schema foreign keys and SQL `JOIN` queries are strictly forbidden. Data sharing must occur asynchronously via NATS JetStream events or synchronously via HTTP API calls.
3.  **Physical DB-per-Service Roadmap**: Because the isolation is enforced at the schema level and contains no hard database-level foreign keys, these schemas can be easily migrated to physically separate database instances when moving to production or when scaling needs arise.

## Consequences
*   **Pros**:
    *   Saves local developer system resources (RAM/CPU) by running only one database instance.
    *   Preserves microservice boundaries—the schemas remain physically separable with zero schema alterations.
    *   Simplifies local setup, backup, and seeding (via a single `db/init-db.sql` and `db/seed.sql` script).
*   **Cons**:
    *   A database container crash will affect all local microservices simultaneously.
    *   Requires developer discipline to avoid writing cross-schema queries in code.
