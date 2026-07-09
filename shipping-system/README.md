# Agent Context — Shipping System (scoped slice)

Load `CLAUDE.md` first (authoritative). All docs below are consistent with the scoped slice.

- `CLAUDE.md` — scope, architecture decisions, conventions, open decisions
- `docs/01-ERD.md` — data model (17 entities) + Mermaid ER diagram (canonical, no separate diagram file)
- `docs/02-HLD.md` — services, NATS subject map, REST endpoints, design solutions
- `docs/03-phases.md` — estimation: timeline, actor coverage, roadmap, 16-day phase plan
- `docs/04-business-rules.md` — the single authoritative Rule Catalogue (BR-01–BR-10) + parcel lifecycle + exception branches
- `docs/05-analysis.md` — original pre-scope-cut analysis, historical context only (do not build against it)
- `docs/06-specification.md` — scoped-slice specification; canonical home for Non-Functional Requirements
- `docs/lld/` — one self-contained file per service (Use Cases, Sequence Diagrams, API DTOs/validation/error codes, DB indexes/constraints); no separate top-level use-case/sequence-diagram doc
- `docs/adrs/` — ADR-001 through ADR-006

Scope: bags & manifests are physical-only (NOT modeled). Tracking is parcel-level.
All documents are synchronized to this scope — no contradictions remain. Rule Catalogue and
NFR tables each live in exactly one file; other docs link to them instead of duplicating.

## How to run / test

**Prerequisites**: Docker (Postgres/Redis/NATS), pnpm, Node.js.

```bash
# 1. Bring up Postgres/Redis/NATS (seeds db/init-db.sql on first run)
docker compose up -d
docker ps --format "{{.Names}}: {{.Status}}"   # expect shipping_postgres, shipping_redis, shipping_nats

# 2. Install deps
pnpm install

# 3. Quality gate (build + lint + unit tests, no services required)
pnpm build
pnpm lint
pnpm test
```

**Running a single app for real** (e.g. `order`, which has a REST surface as of Phase 5):

```bash
export PII_ENCRYPTION_KEY=$(python3 -c "print('ab'*32)")  # 64-char hex; use a real secret outside local dev
export PORT=3099
npx nest start order
```

Then hit it directly:

```bash
curl -s -X POST http://localhost:3099/orders \
  -H "Content-Type: application/json" -H "Idempotency-Key: test-1" \
  -d '{
    "sender": {"name":"Alice","phone":"0900000000","address":"1 Alice St","region_code":"HN01"},
    "recipient": {"name":"Bob","phone":"0911111111","address":"2 Bob St","region_code":"SG01"},
    "parcels": [{"declared_weight_grams":500,"type":"parcel"}],
    "payment_type": "PREPAID_STRIPE"
  }'
```

For a deeper walkthrough of a specific implemented task (syntax rationale, more test cases, DB spot-checks) see the relevant `docs/reference/task-<phase>.<task>-walkthrough.md` if one still exists for that task — those are temporary review docs, deleted once reviewed, so not every task has one.
