# ADR-003: Shared PostgreSQL Instance with Isolated Databases

## Status
Proposed

## Context
A strict microservices architecture requires each service to have its own independent database engine to ensure high availability and prevent cross-service database coupling. However, running 5 separate PostgreSQL database container instances on a local machine for development consumes substantial RAM and CPU resources.

## Decision
For local development, we will run a **single PostgreSQL container instance** in Docker, but configure it with **isolated logical databases** (`db_order`, `db_tracking`, etc.):

1.  We will use an initialization script (`init-db.sql`) to automatically spawn separate logical databases inside the container upon launch.
2.  Each microservice will connect *only* to its designated logical database, using separate connection strings.
3.  No cross-database queries or joins will be allowed. If `order-service` needs data from `tracking-service`, it must use NATS events or HTTP API composition.

## Consequences
*   **Pros**:
    *   Saves local developer system resources (RAM/CPU) by running only one database process.
    *   Preserves the logical boundary of microservices—the databases remain physically separable when moving to production.
*   **Cons**:
    *   If the single database container crashes, all local microservices lose database connectivity simultaneously.
