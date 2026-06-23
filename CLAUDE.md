# NestJS Training Plan
**Book:** *Scalable Application Development with NestJS* (Packt, 2024)

## Repository Layout

```
nestjs/
  user-management-api/      # Week 1 — Foundations (DONE)
  microservices-sample/     # Week 3 — Microservices (DONE)
  e-commerce-api/           # Week 4 — Capstone (planned)
```

---

## Week 1 — Foundations + Core Building Blocks (Ch 1–4) ✅

**Read:** Overview of NestJS → Scalable Architecture Principles → Setting Up Environment → Modules, Controllers, Providers, Decorators

**Practice project:** `user-management-api/`

**Goal:** Understand NestJS fundamentals — why it exists, how modules work, and the basic request lifecycle.

| Day | Read | Build |
|-----|------|-------|
| Mon | Ch 1 — What is NestJS, why it exists, Angular-inspired architecture | Install Node.js + Nest CLI; `nest new user-management-api`; explore generated folder structure |
| Tue | Ch 2 — Scalable Architecture Principles, module system design | Create `UsersModule`; wire `UsersController` + `UsersService` |
| Wed | Ch 3 — Controllers, routing, request lifecycle | Implement `POST /users` + `GET /users`; understand `@Body()`, `@Param()` |
| Thu | Ch 4 — Providers, dependency injection, decorators | Implement `GET /users/:id`, `PUT /users/:id`, `DELETE /users/:id`; in-memory array store |
| Fri | Review Ch 1–4 | Refactor: ensure DI is clean, no logic in controller; write 3 basic service unit tests |

---

## Week 2 — Advanced Core + REST APIs (Ch 5–7, skip GraphQL chapters) ✅

**Read:** Exception Filters, Pipes, Guards, Interceptors → Building REST APIs

**Practice project:** `user-management-api/` (enhanced — users, products, categories)

**Goal:** Production-quality REST APIs with validation, error handling, and security layers.

| Day | Read | Build |
|-----|------|-------|
| Mon | Ch 5 — Pipes and validation | Install TypeORM + SQLite; define `User` entity; replace in-memory store with repository |
| Tue | Ch 5 cont. — DTOs, class-validator | Add `CreateUserDto` / `UpdateUserDto` with `@IsNotEmpty()`, `@IsOptional()`; wire global `ValidationPipe` |
| Wed | Ch 6 — Guards and interceptors | Add `MockAuthGuard` (bearer token check); add `LoggingInterceptor` (request/response timing) |
| Thu | Ch 6 cont. / Ch 7 — Exception filters, REST best practices | Add global `HttpExceptionFilter`; add URI versioning (`/v1/`); implement `ProductsModule` with CRUD |
| Fri | Review Ch 5–7 | Implement `CategoriesModule` + ManyToOne relation to products; write service unit tests for all three modules |

---

## Week 3 — Microservices (Ch 10–11) ✅

**Read:** Building Scalable Microservices + Testing and Debugging

**Practice project:** `microservices-sample/` (monorepo: `api-gateway`, `order`, `inventory`)

**Goal:** Understand how to break a monolith into independently deployable services.

| Day | Status | Read | Build | Deliverables |
|-----|--------|------|-------|--------------|
| Mon | ✅ Done | Ch 10 — Microservices overview, NestJS transport layer, TCP | Scaffold monorepo with `nest-cli.json`; create `order-service` (HTTP `:3001`, TCP `:8001`) with basic CRUD | `apps/order/` bootstrapped as hybrid app; `OrderController` (`POST /create-order`, `GET /orders`); `OrderService` with in-memory store; `INVENTORY_SERVICE` TCP client registered |
| Tue | ✅ Done | Ch 10 cont. — ClientProxy, event patterns, message patterns | Create `inventory-service` (TCP `:8002`); wire `INVENTORY_SERVICE` client in order; emit `order_created` event | `apps/inventory/` bootstrapped as pure TCP microservice; `InventoryController` with `@EventPattern('order_created')`; `InventoryService.handleOrderCreated()` with in-memory stock; `ORDER_SERVICE` TCP client registered |
| Wed | ✅ Done | Ch 10 cont. — Hybrid applications, event-driven design | Handle `order_created` in inventory; emit `order_processed` back; handle in order to update status; verify round-trip manually | `InventoryService` emits `order_processed` with `{ orderId, success, message }`; `OrderController` `@EventPattern('order_processed')` updates order status to `COMPLETED` or `CANCELLED`; full event loop verified |
| Thu | ✅ Done | Ch 11 — Service discovery, Consul (p.298) | Add `ConsulService` to all apps; convert inventory to hybrid (HTTP `:3002`); add `/health` endpoints; API gateway discovers `order-service` via Consul | `ConsulService` in `order`, `inventory`, `api-gateway`; `OnModuleInit` registers with Consul health check URL; `OnModuleDestroy` deregisters; `inventory/main.ts` converted to hybrid (`NestFactory.create` + `connectMicroservice`); `ProxyController` resolves `order-service` URL dynamically via `catalog.service.nodes()`; `ConsulServiceNode` typed interface (no `any[]`) |
| Fri | ✅ Done | Ch 11 cont. — Testing microservices | Unit tests: `OrderService`, `InventoryService`, controllers; integration test: full TCP round-trip on isolated ports | **27 unit tests** — `order.service.spec.ts` (10), `order.controller.spec.ts` (5), `inventory.service.spec.ts` (9), `inventory.controller.spec.ts` (3); **5 integration tests** — `cross-service.integration.spec.ts` using real TCP on `:9001`/`:9002`, `waitFor` polling helper, all 32 tests green |

**Branch:** `feat/service-discovery-consul`

**Key files:**
```
apps/
  api-gateway/src/consul.service.ts       # discovery only (no self-register)
  api-gateway/src/proxy.controller.ts     # dynamic URL via Consul
  api-gateway/src/app.module.ts
  order/src/consul.service.ts             # register on :3001, deregister on shutdown
  order/src/order.controller.ts           # + GET /health
  order/src/order.module.ts
  order/src/order.service.spec.ts         # 10 unit tests
  order/src/order.controller.spec.ts      # 5 unit tests
  order/test/cross-service.integration.spec.ts  # 5 integration tests
  inventory/src/consul.service.ts         # register on :3002, deregister on shutdown
  inventory/src/inventory.controller.ts   # + GET /health
  inventory/src/inventory.module.ts
  inventory/src/main.ts                   # hybrid: HTTP :3002 + TCP :8002
  inventory/src/inventory.service.spec.ts # 9 unit tests
  inventory/src/inventory.controller.spec.ts    # 3 unit tests
```

---

## Week 4 — Real-World + DevOps (Ch 12–18) ⬜

**Read:** Case studies (E-commerce, Social, ERP) → CI/CD → Performance → Security

**Practice project:** `e-commerce-api/` (capstone)

**Goal:** Deliver a deployable, secured, and optimized full application — connecting everything learned.

| Day | Read | Build |
|-----|------|-------|
| Mon | Ch 12–14 — E-commerce, Social, ERP case studies | Scaffold `e-commerce-api`; port users + products + orders from Week 1–2 as modules in a single app |
| Tue | Ch 18 — Security best practices, JWT | Add `JwtModule`; implement `POST /auth/login` (returns JWT) + `JwtAuthGuard`; protect all resource routes |
| Wed | Ch 16 — CI/CD pipelines | Write `Dockerfile` (multi-stage); write GitHub Actions workflow: lint → test → build → Docker build |
| Thu | Ch 17 — Performance, caching | Install `@nestjs/cache-manager` + Redis; cache `GET /products` and `GET /products/:id`; add cache-invalidation on write |
| Fri | Review all | End-to-end smoke test (auth → create order → check inventory); fix gaps; tag `v1.0.0` release |

---

## Agent Rules

### Decision authority

| Action | Autonomous | Must ask first |
|---|---|---|
| Read any file | ✅ | |
| Edit files matching the task scope | ✅ | |
| Run `pnpm test`, `lint`, `build` | ✅ | |
| Create a feature branch | ✅ | |
| Commit on the current branch | ✅ | |
| Add a new dependency | | ✅ |
| Change an existing endpoint's URL, method, or response shape | | ✅ |
| Delete or rename a file | | ✅ |
| Touch more than one project beyond what was asked | | ✅ |
| Push to remote / open a PR | | ✅ |

### Workflow — required steps for every task

1. **Read before writing** — read every file you will modify before touching it.
2. **State scope** — one sentence: what files change and why. If scope is unclear, ask.
3. **Build first** — run `pnpm build` after any structural change.
4. **Lint** — run `pnpm lint`; zero errors required.
5. **Test** — run `pnpm test`; all specs must be green before declaring done.
6. **Commit** — one commit per logical unit following Conventional Commits.

Never declare a task complete if any of steps 3–5 fails.

### Code guardrails

- **No `any`** — use `unknown`, a typed interface, or a proper type.
- **No new abstractions** — don't introduce helpers or base classes unless explicitly required.
- **No new packages** — do not run `pnpm add` without user approval.
- **No comments** — only add a comment when the *why* is non-obvious.
- **No dead code** — no `console.log`, commented-out blocks, or TODO stubs in committed code.
- **Thin controllers** — business logic belongs in the service, never in the controller.

### Git conventions

Branch naming: `feat/<desc>`, `fix/<desc>`, `test/<desc>`, `refactor/<desc>`, `chore/<desc>`

Commit format (Conventional Commits):
```
feat: add jwt authentication middleware
fix: throw NotFoundException when product not found
test: add integration spec for order-inventory round-trip
```

- Never use `--no-verify`
- Never commit directly to `main`
- Never `git push --force`

### Quality gate — non-negotiable before "done"

```bash
pnpm build   # zero TypeScript errors
pnpm lint    # zero ESLint errors
pnpm test    # all specs green
```
