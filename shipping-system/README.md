# Domestic Parcel Shipping System (Scoped Slice)

A NestJS microservices-based domestic parcel shipping system modeled on hub-and-spoke logistics operators (e.g., GHN, GHTK, J&T). It features a vertical slice of order creation, parcel tracking, Stripe payment simulation, line-haul routing, last-mile courier dispatch, and email notifications.

The system uses **NATS JetStream** as an event backbone for per-aggregate serialization and debounced status projections, **Redis** as a read-through cache, and a schema-isolated **PostgreSQL** database.

## System Architecture

```
                       ┌─────────────────┐
                       │   API Gateway   │ (Port 3000)
                       └────────┬────────┘
                                │ (HTTP Reverse Proxy)
         ┌──────────────┬───────┼───────┬──────────────┬──────────────┐
         ▼              ▼       ▼       ▼              ▼              ▼
    ┌─────────┐   ┌─────────┐┌─────┐┌───────┐   ┌─────────┐   ┌──────────────┐
    │  Order  │   │Tracking ││ Hub ││Courier│   │Line-haul│   │  Dispatcher  │ (Ports 3001-3007)
    └────┬────┘   └────┬────┘└─────┘└───────┘   └────┬────┘   └──────┬───────┘
         │             │                             │               │
         └─────────────┼───────────────┬─────────────┴───────────────┘
                       │               │ (NATS core / JetStream)
                       ▼               ▼
                ┌──────────────┐┌──────────────┐
                │ Notification ││ NATS Broker  │ (Pure microservice, no HTTP)
                └──────────────┘└──────────────┘
```

Detailed high-level architecture is documented in [02-HLD.md](file:///home/dunguyen/Training/nestjs/shipping-system/docs/02-HLD.md).

## Quick Start (Dockerized Stack)

### Prerequisites
* Docker & Docker Compose
* Node.js (v20+ recommended)
* pnpm

### 1. Configure Environment
Copy the example environment file and configure variables:
```bash
cp .env.example .env
```
*(The `.env` file contains default Docker-network configurations and a local development `PII_ENCRYPTION_KEY`.)*

### 2. Start the Stack
Bring up the database, cache, NATS broker, and all 8 NestJS applications in the background:
```bash
docker compose up -d --build
```
Verify that all containers are healthy:
```bash
docker compose ps
```
*(You should see containers for `shipping_api_gateway`, `shipping_order`, `shipping_tracking`, `shipping_courier`, `shipping_hub`, `shipping_linehaul`, `shipping_dispatcher`, `shipping_notification`, `shipping_postgres`, `shipping_redis`, and `shipping_nats`.)*

### 3. Run the End-to-End Demo Simulation
We have provided an automated end-to-end happy-path script that simulates the entire lifecycle of a parcel (from order creation to customer delivery) via the API Gateway, validating state machine transitions and projecting order states:
```bash
pnpm demo
```
This script demonstrates:
1. Reseeding the database with clean seed data.
2. Creating a prepaid Stripe order via `POST /orders`.
3. Confirming payment via Stripe Webhook simulation (unlocking the dispatch gate).
4. Courier pickup scan (`POST /couriers/legs/{id}/pickup`), transitioning state to `InTransit`.
5. Origin hub scan (`POST /hubs/{id}/receive`), updating actual weight and route.
6. Line-haul trip creation, truck/driver assignment, departure, and destination hub arrival.
7. Destination hub inbound scan and corrective re-routing check.
8. Courier last-mile leg assignment, transitioning state to `OutForDelivery`.
9. Courier last-mile delivery success (`POST /couriers/legs/{id}/deliver`), transitioning state to `Delivered` and shipment order status to `Complete`.
10. Fetching the final tracking timeline history and checking notification email emulator logs.

---

## Development & Testing

### Running Tests
Our test suite enforces strict TDD conventions (Red-Green-Refactor) for all business rule guards and FSM transitions.

* **Run all Unit Tests**:
  ```bash
  pnpm test
  ```
* **Run E2E Happy-Path Integration Test** (requires the docker stack to be running):
  ```bash
  RUN_INTEGRATION_TEST=true pnpm test
  ```
* **Run Load Test via Artillery** (requires the docker stack to be running):
  ```bash
  # Execute concurrent traffic simulation (60 virtual users, 120 requests)
  npx artillery run load-test.yml
  ```

### Code Quality Gates
Before committing code, make sure the quality gates pass:
```bash
pnpm build      # Compiles all NestJS apps using Webpack
pnpm lint       # Verifies code style via ESLint
pnpm test       # Executes all unit tests (currently 292/292 passing)
```

---

## Git Remotes & GitLab Supporter Review

The repository uses a dual-remote configuration to push full logs/docs to GitHub while presenting clean, code-only branches to GitLab reviewers:

* **GitHub** (`github` remote): Full codebase + development logs + `docs/` + AI configurations (`feat/shipping-system`).
* **GitLab** (`origin` remote): Code-only (no `docs/`, `.claude/`, or `.gemini/` directories). Pushed using the local-only `supporter-review` branch to GitLab's `feat/shipping-system`.

To push updates to GitLab (origin):
```bash
git checkout supporter-review
git merge feat/shipping-system --no-commit
git rm -r --quiet docs .claude .gemini 2>/dev/null || true
git commit -m "chore: sync + strip docs/.claude/.gemini for GitLab"
git push origin supporter-review:feat/shipping-system --force
git checkout feat/shipping-system
```

For more architectural decisions and specifications, consult the documents inside [docs/](file:///home/dunguyen/Training/nestjs/shipping-system/docs/).
