# ADR-002: ORM Selection (TypeORM vs Prisma)

## Status
Accepted

## Context
Each microservice in the Shipping System needs an Object-Relational Mapper (ORM) to communicate with PostgreSQL. The monorepo requires a robust tool that integrates natively with NestJS, supports schema migrations, and handles multiple isolated schemas (`shipping_order_db`, `shipping_tracking_db`, etc. — see ADR-003) cleanly.

## Decision
We choose **TypeORM** over Prisma for this project:

1.  **Native NestJS Integration**: TypeORM is fully supported by the official `@nestjs/typeorm` package, allowing clean dependency injection via `@InjectRepository` and built-in transaction management.
2.  **Flexible Database Connections**: TypeORM supports a per-entity/per-connection `schema` option, so each service's `DataSource` can be scoped to its own Postgres schema (`shipping_order_db`, `shipping_tracking_db`, ...) within the single shared `postgres` database (ADR-003), without cross-schema FKs.
3.  **Active Record & Data Mapper Patterns**: TypeORM supports the Data Mapper pattern, keeping entities clean of active-record database logic, which aligns better with Domain-Driven Design (DDD).

## Consequences
*   **Pros**:
    *   Strong integration with NestJS patterns.
    *   Simplified connection management across microservices.
*   **Cons**:
    *   TypeORM queries can sometimes be more verbose than Prisma's fluent API.
    *   Requires writing TypeORM migration scripts instead of Prisma's automatic database push commands.
