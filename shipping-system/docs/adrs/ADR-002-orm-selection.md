# ADR-002: ORM Selection (TypeORM vs Prisma)

## Status
Proposed

## Context
Each microservice in the Shipping System needs an Object-Relational Mapper (ORM) to communicate with PostgreSQL. The monorepo requires a robust tool that integrates natively with NestJS, supports schema migrations, and handles multiple isolated databases (`db_order` and `db_tracking`) cleanly.

## Decision
We choose **TypeORM** over Prisma for this project:

1.  **Native NestJS Integration**: TypeORM is fully supported by the official `@nestjs/typeorm` package, allowing clean dependency injection via `@InjectRepository` and built-in transaction management.
2.  **Flexible Database Connections**: TypeORM handles separate connection configurations for different database schemas (`db_order` and `db_tracking`) without requiring complex multi-schema hacks.
3.  **Active Record & Data Mapper Patterns**: TypeORM supports the Data Mapper pattern, keeping entities clean of active-record database logic, which aligns better with Domain-Driven Design (DDD).

## Consequences
*   **Pros**:
    *   Strong integration with NestJS patterns.
    *   Simplified connection management across microservices.
*   **Cons**:
    *   TypeORM queries can sometimes be more verbose than Prisma's fluent API.
    *   Requires writing TypeORM migration scripts instead of Prisma's automatic database push commands.
