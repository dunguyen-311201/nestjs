# E-Commerce NestJS Microservices

A NestJS monorepo demonstrating microservices architecture with service discovery via Consul.

## Architecture

### Request flow (HTTP)

```
API Gateway (HTTP :3000, JWT-guarded routes)
  ├─ discover via Consul ──► Order Service    (HTTP :3001)  [registered in Consul]
  ├─ fallback localhost  ──► Product Service  (HTTP :3004)  [not registered — fallback only]
  └─ fallback localhost  ──► User Service     (HTTP :3003)  [not registered — fallback only]
```

### Event flow (TCP, order creation)

Inventory is the hub for both legs — Order and Product never talk to each other directly:

```
1. Order Service     ──TCP emit ORDER_CREATED────────► Inventory Service
2. Inventory Service ──TCP send RESERVE_STOCK (req/reply)─► Product Service
3. Inventory Service ──TCP emit ORDER_PROCESSED───────► Order Service   (after the RESERVE_STOCK reply)
```

Both `order` and `inventory` register themselves in Consul (with `/health` checks); `user` and `product` don't, so the gateway always falls back to their hardcoded `localhost` URLs.

| Service | HTTP Port | TCP Port | Registers with Consul | Database | Purpose |
|---|---|---|---|---|---|
| api-gateway | 3000 | — | no (discovers others) | — | JWT-guarded HTTP proxy; routes to user/product/order services |
| order | 3001 | 8001 | yes | `order_db` | Manages orders; emits `ORDER_CREATED`, listens for `ORDER_PROCESSED` |
| inventory | 3002 | 8002 | yes | none (stateless) | Listens for `ORDER_CREATED`, calls product service to reserve stock, emits `ORDER_PROCESSED` |
| user | 3003 | — | no | `user_db` | Auth (signup/login) + user CRUD |
| product | 3004 | 8003 | no | `product_db` | Product/category CRUD; handles `RESERVE_STOCK` TCP messages from inventory |

## Prerequisites

- Node.js >= 18
- pnpm
- Docker (used to run Consul and PostgreSQL locally — see below)
- Consul
- PostgreSQL

## Install Consul

**macOS:**
```bash
brew install consul
```

**Linux:**
```bash
# Download and install
wget https://releases.hashicorp.com/consul/1.18.1/consul_1.18.1_linux_amd64.zip
unzip consul_1.18.1_linux_amd64.zip
sudo mv consul /usr/local/bin/
```

**Docker:**
```bash
docker run -d --name consul -p 8500:8500 hashicorp/consul agent -dev -client=0.0.0.0
```

## Database (PostgreSQL)

Each service owns its own database (database-per-service):

| Service | Database | Tables |
|---|---|---|
| order | `order_db` | `order`, `order_item` |
| product | `product_db` | `category`, `product`, `reservation` |
| user | `user_db` | `user` |
| inventory | _none_ | inventory is a stateless TCP orchestrator (no entities, no `TypeOrmModule`); stock reservations live in `product_db.reservation` |

### Environment variables

Each service's `TypeOrmModule.forRoot()` reads these (defaults shown):

| Var | Default |
|---|---|
| `DB_HOST` | `localhost` |
| `DB_PORT` | `5432` |
| `DB_USERNAME` | `postgres` |
| `DB_PASSWORD` | `postgres` |
| `DB_NAME` | per service, e.g. `order_db` |

`synchronize: true` is enabled, so tables are created/updated from entities automatically on boot. TypeORM does **not** create the database itself, so each database must exist before its service starts.

### Start Postgres

```bash
docker run -d --name postgres-dev -p 5432:5432 -e POSTGRES_PASSWORD=postgres postgres:16-alpine
```

### Create the per-service databases

```bash
docker exec postgres-dev psql -U postgres -c "CREATE DATABASE order_db;"
docker exec postgres-dev psql -U postgres -c "CREATE DATABASE product_db;"
docker exec postgres-dev psql -U postgres -c "CREATE DATABASE user_db;"
```

### Inspect the data

```bash
# List databases
docker exec postgres-dev psql -U postgres -c "\l"

# List tables in a database
docker exec postgres-dev psql -U postgres -d order_db -c "\dt"

# Interactive shell
docker exec -it postgres-dev psql -U postgres -d order_db
```

## Setup

```bash
pnpm install
```

## Running the App

### 1. Start PostgreSQL

```bash
docker start postgres-dev || docker run -d --name postgres-dev -p 5432:5432 -e POSTGRES_PASSWORD=postgres postgres:16-alpine
```

The first time you run this, also create the per-service databases — see [Database (PostgreSQL)](#database-postgresql).

### 2. Start Consul

```bash
consul agent -dev
```

Consul UI is available at http://localhost:8500

### 3. Start each service in separate terminals

```bash
# Terminal 1 — Order service
pnpm nest start order --watch

# Terminal 2 — Inventory service
pnpm nest start inventory --watch

# Terminal 3 — Product service
pnpm nest start product --watch

# Terminal 4 — User service
pnpm nest start user --watch

# Terminal 5 — API Gateway
pnpm nest start api-gateway --watch
```

### Verify services are registered

Open http://localhost:8500/ui/dc1/services — you should see `order-service` and `inventory-service` listed. `user` and `product` don't register with Consul, so they won't appear here even when running.

> **Known issue:** `order-service`'s Consul health check is configured to call `http://localhost:3001/health`, but `OrderController`'s actual health route is `GET /v1/orders/health` and sits behind the controller's class-level `JwtAuthGuard`. Expect `order-service` to show **critical**, not passing, in the Consul UI. This doesn't break gateway routing today — `RouteProxyService` resolves via `catalog.service.nodes()`, which returns all registered nodes regardless of health — but the check itself is misconfigured. Not fixed here since it touches endpoint behavior; flag if you'd like it patched.

## API Endpoints

All routes below are exposed through the **API Gateway (port 3000)**, versioned under `/v1`. Everything except `/v1/auth/*` requires `Authorization: Bearer <jwt>`.

| Method | Path | Proxied to | Description |
|---|---|---|---|
| POST | `/v1/auth/signup` | user-service | Create a user account |
| POST | `/v1/auth/login` | user-service | Log in, returns a JWT |
| GET/POST | `/v1/users`, `/v1/users/:id` | user-service | User CRUD |
| GET/POST | `/v1/products`, `/v1/products/:id` | product-service | Product CRUD |
| GET/POST | `/v1/categories`, `/v1/categories/:id` | product-service | Category CRUD |
| GET/POST | `/v1/orders`, `/v1/orders/:id` | order-service | Order creation/lookup |

Each backing service also exposes its own HTTP API directly (e.g. for local testing without the gateway):

| Service | Port | Notable routes |
|---|---|---|
| order | 3001 | `POST /v1/orders`, `GET /v1/orders`, `GET /v1/orders/:id`, `GET /v1/orders/health` (all JWT-guarded, including health — see known issue above) |
| inventory | 3002 | `GET /health`, unguarded (no other business HTTP routes — driven entirely by TCP events) |
| user | 3003 | `POST /v1/auth/signup`, `POST /v1/auth/login`, `/v1/users` CRUD |
| product | 3004 | `/v1/products` CRUD, `/v1/categories` CRUD |

## Example Request

```bash
# 1. Log in to get a JWT
TOKEN=$(curl -s -X POST http://localhost:3000/v1/auth/login \
  -H "Content-Type: application/json" \
  -d '{"username": "alice", "password": "secret"}' | jq -r .data.accessToken)

# 2. Create an order
curl -X POST http://localhost:3000/v1/orders \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer $TOKEN" \
  -d '{
    "customerId": "11111111-1111-1111-1111-111111111111",
    "items": [{ "productId": "22222222-2222-2222-2222-222222222222", "quantity": 2, "unitPrice": 9.99 }]
  }'
```

## How Service Discovery Works

1. On startup, `order-service` and `inventory-service` register themselves with Consul (name, host, port, health check URL).
2. Consul periodically calls each service's `GET /health` endpoint to verify availability.
3. When the API Gateway receives a request, it queries Consul for the current address of the target service before forwarding. If Consul has no healthy nodes for that service — which is always the case for `user-service` and `product-service`, since they don't register — it falls back to a hardcoded `localhost` URL (see `RouteProxyService.fallbackUrls`).
4. On shutdown, each registered service deregisters itself from Consul.

## Tests

```bash
# Unit tests
pnpm test

# Test coverage
pnpm test:cov
```

## Project Structure

```
apps/
  api-gateway/     # JWT-guarded HTTP gateway, port 3000
  order/           # Order microservice, HTTP :3001 / TCP :8001, order_db
  inventory/       # Inventory microservice, HTTP :3002 / TCP :8002, stateless
  user/            # User + auth microservice, HTTP :3003, user_db
  product/         # Product/category microservice, HTTP :3004 / TCP :8003, product_db
libs/
  constants/       # Shared event/message pattern constants
  shared/          # Shared types/DTOs
  common/          # Shared guards (JwtAuthGuard), interceptors, filters, middleware
```
