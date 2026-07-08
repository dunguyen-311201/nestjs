# Progress Log

> Updated after every task/session. The **Resume point** is the first thing to
> read at the start of a session (`/recap` reads this automatically). Newest
> log entries on top. This is a session-handoff pointer, not a duplicate of
> `TASKS.md` (daily log) — `TASKS.md` wins for detailed history, this file
> wins for "what's next."

## Resume point

- **Current phase:** Phase 5 — Core Backend (6.0d), not yet started. See
  `docs/03-phases.md`.
- **Next task:** `5.1` Order Service — entities, DTOs, order-creation logic.
  Run `/begin-task 5.1` to start it.
- **Branch:** `feat/shipping-system` (tracks `github/feat/shipping-system`;
  see `CLAUDE.md` § Git Remotes for the dual-remote setup).
- **State:** Phase 4 (Project Setup) complete and committed (`ce6d072`
  `feat: scaffold 8 apps with schema-scoped TypeORM + /health`). All 8 apps +
  3 shared libs (`contracts`, `dtos`, `crypto`) scaffolded under NestJS
  Standard Monorepo mode (`nest-cli.json` `projects` map, single root
  `package.json` — kept deliberately, see `docs/03-phases.md` Phase 4 and
  `docs/reference/phase-4-implementation-checklist.md`). `pnpm build` / `pnpm lint` / `pnpm test`
  all green (9 tests: `libs/crypto` PII round-trip, `libs/dtos` barcode
  validator). No business logic yet — that's Phase 5.
- **Notes:** Pricing is in-process inside `order` (own named TypeORM
  connection, not its own app — see `apps/order/src/app.module.ts` and
  `docs/lld/pricing-service.md`). Docs-only commits since Phase 4 (dual-remote
  git workflow write-up).

## Log

### 2026-07-08 — Session tooling
- Added `/begin-task`, `/wrap-task`, `/recap` slash commands
  (`.claude/commands/`) to enforce the `CLAUDE.md` Workflow section
  (read→state scope→build→lint→test→commit) and the TDD rule in
  `docs/lld/00-conventions.md` without relying on remembering it each session.
  Added numbered sub-tasks (`5.1`, `5.2`, ...) to every phase in
  `docs/03-phases.md` so the commands address one concrete task instead of an
  entire multi-day phase.
- Added this file (`docs/PROGRESS.md`) as the session resume-point,
  complementing `TASKS.md`'s daily log.
- Added `docs/reference/` for raw/original design artifacts, kept separate
  from the synthesized docs in `docs/`.
- Documented the Ports & Adapters DI convention in `docs/lld/00-conventions.md`
  for Phase 5+ service implementation, plus a `.claude/skills/nest-service-module/`
  skill to scaffold new modules against it.
- Moved `init-db.sql`/`seed.sql`/`queries.sql` from repo root into `db/`;
  deleted `demo_queries.sql` (superseded draft of `queries.sql`, unused by any
  tooling). Updated every reference (docker-compose mount, verify-local.sh,
  generate_seed.py, consistency-auditor agent, ADR-003, seeding-analysis doc,
  `.idea` datasource mapping) and confirmed the stack still boots/seeds/queries
  clean from the new path.

### 2026-07-07 — Phase 4 complete
- All 8 apps + 3 libs scaffolded, schema-scoped TypeORM connections wired,
  `/health` endpoints added. See `TASKS.md` 2026-07-07 entry and
  `docs/reference/phase-4-implementation-checklist.md` for the full
  breakdown (6 sequential MRs/branches, TDD for `libs/crypto` and `libs/dtos`).
