# NestJS Microservices Sample

A NestJS monorepo demonstrating microservices architecture with service discovery via Consul.

## Architecture

```
┌─────────────────────────────────────────────────────┐
│                    Consul (port 8500)                │
│              Service Registry & Discovery            │
└──────────┬─────────────────────┬────────────────────┘
           │ register            │ register
           ▼                     ▼
┌──────────────────┐   ┌──────────────────────┐
│   Order Service  │   │  Inventory Service   │
│  HTTP :3001      │◄──│  HTTP :3002          │
│  TCP  :8001      │   │  TCP  :8002          │
└──────────────────┘   └──────────────────────┘
           ▲
           │ discover via Consul
┌──────────────────┐
│   API Gateway    │
│   HTTP :3000     │
└──────────────────┘
```

| Service | HTTP Port | TCP Port | Purpose |
|---|---|---|---|
| api-gateway | 3000 | — | Routes client requests, discovers services via Consul |
| order | 3001 | 8001 | Manages orders |
| inventory | 3002 | 8002 | Manages inventory |

## Prerequisites

- Node.js >= 18
- pnpm
- Consul

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

## Setup

```bash
pnpm install
```

## Running the App

### 1. Start Consul

```bash
consul agent -dev
```

Consul UI is available at http://localhost:8500

### 2. Start each service in separate terminals

```bash
# Terminal 1 — Order service
pnpm nest start order --watch

# Terminal 2 — Inventory service
pnpm nest start inventory --watch

# Terminal 3 — API Gateway
pnpm nest start api-gateway --watch
```

### Verify services are registered

Open http://localhost:8500/ui/dc1/services — you should see `order-service` and `inventory-service` listed with passing health checks.

## API Endpoints

### API Gateway (port 3000)

| Method | Path | Description |
|---|---|---|
| POST | `/orders` | Create a new order (proxied to order service via Consul discovery) |

### Order Service (port 3001)

| Method | Path | Description |
|---|---|---|
| GET | `/health` | Health check (used by Consul) |
| GET | `/orders` | List all orders |
| POST | `/create-order` | Create an order |

### Inventory Service (port 3002)

| Method | Path | Description |
|---|---|---|
| GET | `/health` | Health check (used by Consul) |

## Example Request

```bash
curl -X POST http://localhost:3000/orders \
  -H "Content-Type: application/json" \
  -d '{"productId": "abc123", "quantity": 2}'
```

## How Service Discovery Works

1. On startup, `order-service` and `inventory-service` register themselves with Consul (name, host, port, health check URL).
2. Consul periodically calls each service's `GET /health` endpoint to verify availability.
3. When the API Gateway receives a request, it queries Consul for the current address of `order-service` before forwarding — no hardcoded URLs.
4. On shutdown, each service deregisters itself from Consul.

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
  api-gateway/     # HTTP gateway, port 3000
  order/           # Order microservice, HTTP :3001 / TCP :8001
  inventory/       # Inventory microservice, HTTP :3002 / TCP :8002
libs/
  constants/       # Shared event constants
  shared/          # Shared types/DTOs
```
