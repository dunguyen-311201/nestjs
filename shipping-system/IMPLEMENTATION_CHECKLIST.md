# Phase 4 Implementation Checklist — Monorepo Scaffold + Shared Libs

Detailed checklist for the currently-approved implementation plan (see
`docs/03-phases.md` Phase 4: "Initialize Monorepo & NestJS service scaffolds" +
"Build shared libs"). Scope is infra/plumbing only — no business logic, no
per-service entities beyond a smoke-test query. That's Phase 5.

Check items off as they're done. Keep this in sync with the task list; if they
drift, this file wins for what's actually shipped, the task list wins for
who's working on what right now.

## Step 0 — Correct `docs/adrs/ADR-003-shared-db-for-slice.md`

- [x] Status: `Proposed` → `Accepted`
- [x] Retitle to "Shared PostgreSQL Instance with Schema-per-Service Isolation"; rewrite Decision section around schemas, not separate databases
- [x] Add Migration Roadmap (schema-per-service now for MVP RAM/CPU savings → `pg_dump --schema=X` split to DB-per-service later, no table redesign)

## Monorepo scaffold

- [x] `nest-cli.json`: `"monorepo": true`, `projects` map for 8 apps (see below) + 3 libs
- [x] Root `tsconfig.json`: `@app/contracts`, `@app/dtos`, `@app/crypto` path aliases
- [x] Root `package.json`: scripts, Jest config inlined (`testRegex`, `roots: ["<rootDir>/apps/", "<rootDir>/libs/"]`, **`moduleNameMapper`** for the `@app/*` aliases — not just `tsconfig.json` paths)
- [x] Install: `@nestjs/typeorm`, `typeorm`, `pg`, `@nestjs/config`, `nats` (raw client). **Not** `@nestjs/microservices` yet — deferred to Phase 5 (JetStream transport approach undecided)

## Shared libs (`libs/`)

- [x] `libs/crypto` — TDD: write `crypto.spec.ts` first (round-trip; distinct ciphertext per call via random IV; tampered ciphertext throws), confirm red, then implement AES-256-GCM `encrypt`/`decrypt` keyed by `process.env.PII_ENCRYPTION_KEY` until green
- [x] `libs/contracts` — one `.ts` interface per NATS event from `docs/02-HLD.md` subject map, `V1` suffix
- [x] `libs/dtos` — barcode format validator (`PA-XXXX`) + `Idempotency-Key` header decorator/DTO (`docs/lld/00-conventions.md`)

## Apps (8 — not 9; Pricing is in-process, not a separate app)

Bootstrap model verified per-service against each LLD's actual "API Contracts" section — not assumed uniform.

- [x] `api-gateway` — :3000, HTTP only, no DB, routes to services via static `*_SERVICE_URL` env vars (no Consul)
- [x] `order` — :3001, Hybrid-ready (HTTP now; NATS deferred), schema `shipping_order_db`, embeds Pricing module in-process (own connection to `shipping_pricing_db`) per Pricing's LLD "in-process-boundary" rule
- [x] `tracking` — :3003, schema `shipping_tracking_db` — has a real `GET /tracking/{tracking_id}`, keep HTTP
- [x] `courier` — :3004, schema `shipping_courier_db`
- [x] `hub` — :3005, schema `shipping_network_db`
- [x] `linehaul` — :3006, schema `shipping_network_db`
- [x] `dispatcher` — :3007, schema `shipping_network_db`
- [x] `notification` — no HTTP port, bare `NestFactory.create()` context (no `listen()`, no `createMicroservice()` yet), no DB — confirmed zero REST endpoints in its LLD

For every DB-backed app:
- [x] TypeORM `DataSource` uses `schema: 'shipping_x_db'` (not a separate `database`), **`synchronize: false`**
- [x] `GET /health` runs a real `SELECT 1` through that `DataSource`

## Verification

- [x] `pnpm install` succeeds
- [x] `pnpm build` — 0 TypeScript errors across all 8 apps (`nest build --all`)
- [x] `pnpm lint` — 0 errors
- [x] `libs/crypto` Jest suite: red before implementation, green after (9/9 tests pass across `libs/crypto` + `libs/dtos`)
- [x] `docker compose up -d` (via `./scripts/verify-local.sh`), then started each DB-backed app and `curl`'d `/health` → real `SELECT 1` success against `shipping_postgres` for all 6 (including `order`'s two connections: `shipping_order_db` + embedded Pricing's `shipping_pricing_db`), plus `api-gateway` (no DB)
- [x] `notification` bootstrap: raw `nats` client connected/disconnected cleanly against `shipping_nats`, clean exit code 0

**Phase 4 remainder: done.** Next up is Phase 5 (Core Backend) per `docs/03-phases.md`.

## Explicitly out of scope here (Phase 5)

- Per-service entities, DTOs, use-case/business logic
- `@nestjs/microservices` / actual JetStream consumer wiring (streams, durable consumers, ack, `Nats-Msg-Id` dedup, per-order subject)
- API Gateway auth/RBAC logic (routing skeleton only in Phase 4)
