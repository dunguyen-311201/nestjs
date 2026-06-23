# Chapter 12 — Case Study 1: E-commerce Application

**Book:** *Scalable Application Development with NestJS* (Packt, 2025)
**Pages:** 341–403
**Branch:** `feat/e-commerce-api`
**Project:** `nestjs/e-commerce/` (renamed from `microservices-sample/`)

---

## Overview

Full-stack e-commerce demo applying Ch 1–11 NestJS skills:
- **Backend** — NestJS REST API (`apps/e-commerce/`, port 3000): TypeORM + SQLite, JWT auth, real relations
- **Frontend** — Next.js 14 App Router (`frontend/`, port 3001): product listing, auth, order placement

**Project structure**

```
e-commerce/
├── apps/
│   ├── e-commerce/       ← NEW: NestJS REST API (Ch 12)
│   ├── api-gateway/      existing Ch 11
│   ├── order/ inventory/ existing Ch 10–11
│   ├── product/ user/    existing Ch 10
│   └── microservices-sample/  default boilerplate
├── libs/
│   ├── common/           @app/common — reused across all apps
│   ├── constants/
│   └── shared/
├── frontend/             ← NEW: Next.js 14 App Router
│   ├── src/app/
│   │   ├── products/     list + detail pages
│   │   ├── orders/       order list (auth-protected)
│   │   └── auth/         login + register pages
│   ├── lib/api.ts        typed fetch wrapper
│   └── types/index.ts    mirrors API response shapes
├── pnpm-workspace.yaml   ← NEW: includes frontend/
├── nest-cli.json
└── package.json          name: e-commerce
```

**Implementation approach — monorepo reuse:**
- `@app/common` — `HttpExceptionFilter`, `LoggingInterceptor`, `LoggingMiddleware` imported directly
- `apps/product/` — Product entity + service adapted (add `image`, `specs`; drop category)
- `apps/user/` — User entity + service adapted (add `password`, `role`, `findByEmail`)
- `apps/order/` — concepts adapted; in-memory store replaced with TypeORM

**Adaptations from the book:**
- SQLite (`better-sqlite3`) instead of PostgreSQL — already in monorepo
- `pnpm` instead of `yarn`
- Skip Gemini AI async validator — `ProductSpecs` covers the custom-validator concept
- Category relation dropped from Product — out of scope for Ch 12

---

## 1. Requirements

### Functional requirements

| Domain | Operations |
|--------|-----------|
| Products | CRUD + paginated list + search/filter |
| Orders | Create, list (paginated), get by id; status lifecycle |
| Users | Register, login, get profile |
| Auth | JWT issue on login; guard protected routes |

### Response contract — all endpoints

```typescript
interface APIResponse<T> {
  success: boolean;
  message: string;
  data: T;
  error?: HttpException;
}
```

### Soft-delete

All mutable resources prefer soft-delete (mark as deleted) over hard DELETE. Hard-delete runs as a cleanup job on already-soft-deleted records.

---

## 2. API Design

### URIs implemented in this practice

```
# auth
POST /auth/register
POST /auth/login

# products
POST   /products
GET    /products?page=1&limit=10
GET    /products/:id
PUT    /products/:id
DELETE /products/:id

# orders  (JWT-protected)
POST   /orders
GET    /orders?page=1&limit=10
GET    /orders/:id

# users  (JWT-protected)
GET    /users/:id
PUT    /users/:id
```

---

## 3. Data Model

```
User ─────┐
           │ 1:N
           ▼
         Order ──────► Product
         (ManyToOne)   (ManyToOne)
```

### Entities

#### Product

| Field | Type | Notes |
|-------|------|-------|
| id | uuid | PK |
| name | text | 5–25 chars |
| description | text | 25–255 chars |
| price | decimal(5,2) | > 0 |
| image | text | valid URL |
| specs | simple-json | allowlisted keys |
| createdAt | timestamp | auto |

#### Order

| Field | Type | Notes |
|-------|------|-------|
| id | uuid | PK |
| quantity | int | positive |
| totalPrice | decimal(5,2) | positive |
| status | enum | PENDING / APPROVED / DECLINED / CANCELLED |
| product | ManyToOne → Product | eager or via relations[] |
| customer | ManyToOne → User | attached from JWT on create |
| createdAt | timestamp | auto |

#### User

| Field | Type | Notes |
|-------|------|-------|
| id | uuid | PK |
| email | text | unique |
| password | text | bcrypt hash |
| role | enum | CUSTOMER / ADMIN |
| createdAt | timestamp | auto |

---

## 4. Implementation Plan (by task)

### Phase 0 — Setup

- T01: Add `e-commerce` app to monorepo via `nest g app e-commerce`
- T02: Wire `ConfigModule` + `TypeOrmModule` (single `ecommerce.sqlite`) in `ECommerceModule`

### Phase 1 — Products (adapt from `apps/product/`)

| Task | Reuse from | Change |
|------|-----------|--------|
| T03: Product entity | `apps/product/src/entities/product.entity.ts` | Add `image`, `specs`; remove `category` relation |
| T04: `ProductSpecs` custom validator | New | Allowlist validator for `specs` keys |
| T05: Product DTOs | `apps/product/src/dto/create-product.dto.ts` | Add `image` + `specs` validation; remove `categoryId` |
| T06: `ProductsService` | `apps/product/src/products.service.ts` | Remove category logic; remove `plainToInstance` transform |
| T07: `ProductsController` | `apps/product/src/products.controller.ts` | Remove category params |

### Phase 2 — Orders (new TypeORM — adapts concepts from `apps/order/`)

- T08: `Order` entity + `OrderStatus` enum — TypeORM-backed (replaces in-memory store from `apps/order/`)
- T09: `CreateOrderDto`
- T10: `OrdersService` — `create` checks product exists first; `findAll`; `findOne`
- T11: `OrdersController`

### Phase 3 — Users + Auth (adapt from `apps/user/`)

| Task | Reuse from | Change |
|------|-----------|--------|
| T12: User entity | `apps/user/src/entities/user.entity.ts` | Add `password` (`select: false`), `role` enum; remove `avatarUrl` |
| T13: User DTOs | `apps/user/src/dto/create-user.dto.ts` | Add `password` field |
| T14: `UsersService` | `apps/user/src/users.service.ts` | Add `bcrypt` hashing in `create`; add `findByEmail` |
| T15: `AuthModule` | New | `POST /auth/register` + `POST /auth/login` + JWT issue |
| T16: `JwtAuthGuard` + `JwtStrategy` | New | `passport-jwt` strategy reading `JWT_SECRET` from env |
| T17: Protect routes | New | `@UseGuards(JwtAuthGuard)` on orders; attach `req.user` to order |

### Phase 4 — Cross-cutting (reuse `@app/common`)

| Task | Reuse from | Change |
|------|-----------|--------|
| T18: `TransformInterceptor` | New — add to `libs/common/` | Adds `{ success, message, data }` envelope |
| T19: `HttpExceptionFilter` | Already in `libs/common/` | Just wire it globally in `main.ts` |
| T20: URI versioning + `ValidationPipe` | New wiring | `enableVersioning` + `useGlobalPipes` in `main.ts` |
| T21: Unit tests | Adapt from `apps/product/` + `apps/user/` test patterns | `ProductsService` + `OrdersService` specs |
| T22: Quality gate | — | `nest build e-commerce && pnpm lint && pnpm test` |

---

## 5. Key Patterns

| Pattern | File(s) | Why |
|---------|---------|-----|
| `@ValidatorConstraint` | `custom-validators/ProductSpecs.ts` | Business rules at the input boundary |
| `@InjectRepository` | all services | TypeORM repository pattern |
| `ManyToOne` / `OneToMany` | Order ↔ Product, Order ↔ User | Relational integrity in the DB |
| `forRootAsync` + `ConfigService` | `app.module.ts` | Keep secrets out of source code |
| Global `ValidationPipe` | `main.ts` | Reject invalid input before it reaches the service |
| `TransformInterceptor` | `main.ts` | Consistent `APIResponse` envelope |
| `JwtAuthGuard` | orders/users controllers | Protect write endpoints |

---

## 6. What's Different vs Earlier Chapters

| Earlier (Ch 1–11) | This chapter |
|------------------|-------------|
| In-memory arrays | SQLite via TypeORM |
| Simple `@IsNotEmpty()` | Custom `@ValidatorConstraint` with business logic |
| `MockAuthGuard` | Real JWT (`@nestjs/jwt` + `passport-jwt`) |
| Single module | Multi-module: Products, Orders, Users, Auth |
| Hard-coded config | `ConfigModule` + `.env` |
