# Daily Task Log

One entry per day. Add a new `## YYYY-MM-DD` section at the top (newest first).
End of day, copy the "Done" bullets straight into your report.

## 2026-07-08

### Done
- Reviewed current project structure (apps/libs/docs layout, build/lint/test all green) at user's request.
- Explored sibling practice repo `../nhat.duong/facebook-creator-platform` (separate git repo, unrelated to this project) to extract structure/AI-agent-config ideas; reads of its `CLAUDE.md`/`.claude/settings.json`/`.mcp.json`/`docs/CODING-STANDARDS.md` were blocked by a safety hook (likely foreign-instruction guard) — worked from `docs/DECISIONS.md`, `docs/PROGRESS.md`, `.claude/commands/*`, `.claude/skills/*` instead.
- Asked and confirmed with user: keep the current NestJS Standard Monorepo mode (single `package.json` + `nest-cli.json` projects map) rather than converting to a true per-app pnpm workspace — avoids contradicting the already-accepted Phase 4 ADR/checklist.
- Added `.claude/commands/begin-task.md`, `wrap-task.md`, `recap.md` — slash commands enforcing the `CLAUDE.md` Workflow section and the TDD rule in `docs/lld/00-conventions.md`. Added numbered sub-tasks (`5.1`, `5.2`, ...) to every phase in `docs/03-phases.md` so the commands address one concrete task, not a whole multi-day phase.
- Added `docs/PROGRESS.md` with a "Resume point" section (current phase, next task, branch, state) plus a dated log — session-handoff pointer complementing `TASKS.md`.
- Added `docs/reference/` (with `README.md`) for raw/original design artifacts, kept separate from the synthesized numbered docs.
- Added "Dependency Injection — Ports & Adapters" convention to `docs/lld/00-conventions.md` (v1.3): repository/event-publisher ports as abstract classes, TypeORM/NATS confined to adapters, BR guard failures stay exceptions (no Result pattern, no new dependency).
- Added `.claude/skills/nest-service-module/SKILL.md` to scaffold new Phase 5+ feature modules against that convention (port/adapter/entity/dto/service/module templates using `@app/contracts`/`@app/dtos`).
- Added `.husky/pre-commit` (`pnpm lint && pnpm test`) + `husky@9.1.7` dev dependency at user's request (flagged per `CLAUDE.md`'s new-dependency gate). Did NOT run `git config core.hooksPath` myself (hard rule) — user needs to run `pnpm install` once to activate it locally.
- Clarified DI port naming in `docs/lld/00-conventions.md` (v1.4): `I` prefix (`IOrderRepository`, `IEventPublisher`) marks injectable ports specifically, distinct from `libs/contracts`'s unprefixed data-shape interfaces — kept at user's explicit preference.
- Deleted `demo_queries.sql` — a stale draft fully superseded by `queries.sql` (same 5 queries, minus bug fixes, minus 6 later-added queries), unreferenced by any script/hook. Moved `init-db.sql`, `seed.sql`, `queries.sql` into `db/`; updated all references (`docker-compose.yml` volume mount, `scripts/verify-local.sh`, `generate_seed.py`, `.claude/agents/consistency-auditor.md`, `docs/adrs/ADR-003-shared-db-for-slice.md`, `docs/05-database-seeding-analysis.md`, `.idea/{data_source_mapping,sqldialects}.xml`). Verified end-to-end via `scripts/verify-local.sh` (container recreated on the new mount path, seed + queries ran clean).
- Moved `IMPLEMENTATION_CHECKLIST.md` (100% checked off, Phase 4 archive) from root to `docs/reference/phase-4-implementation-checklist.md`; kept `TASKS.md` at root (deliberate per this file's own header, unlike the checklist). Updated `docs/PROGRESS.md` and `docs/reference/README.md` to match.

### Decisions / open questions
- Deliberately did NOT convert to a true pnpm workspace (per-app `package.json`) — user chose to keep Standard Monorepo mode; revisit only if a documented trigger (independent per-app versioning/deploy need) shows up, and write an ADR first if so.

### Next
- Phase 5 — Core Backend: start with task **5.1** Order Service entities/DTOs/order-creation logic (see `docs/PROGRESS.md` Resume point). Use `/begin-task 5.1` to kick it off.

<!-- Template for a new day:
## YYYY-MM-DD

### Done
-

### In progress / blocked
-

### Decisions / open questions
-

### Next
-
-->

## 2026-07-07

### Done
- Reviewed `docs/01-ERD.md` PARCEL vs PROOF_OF_DELIVERY cardinality; confirmed `1:N` is technically correct due to RTS (Return-to-Sender) leg producing a second POD under the same parcel ID; updated relationship table in `docs/01-ERD.md` to document this nuance.
- Added deferred/out-of-scope notes for a possible future "post-delivery return" flow in `docs/01-ERD.md` and `docs/04-business-rules.md`.
- Added zone-to-zone pricing queries (current rate-card price vs. locked order price) to `queries.sql`.
- Reviewed all queries in `queries.sql` against BRs/NFRs/use cases; fixed several bugs (artificial `LIMIT 5` hiding SLA violations, `INNER JOIN` dropping never-scanned parcels, wrong revenue filter, mislabeled `outcome` column) and added missing coverage (UC-04 order-level aggregation, BR-08 payment-gate audit, BR-06 weight-discrepancy audit, POD completeness check).
- Discovered the running `shipping_postgres` container's schema was stale vs. `init-db.sql` (missing `outcome`, `effective_from`/`effective_to`, wrong FK column name on `PROOF_OF_DELIVERY`).
- Recreated `docker-compose.yml` (postgres + redis + nats, was missing from disk), rebuilt the postgres volume so `init-db.sql` applies cleanly, and reseeded from `seed.sql`.
- Renamed `scan_event_id` to `tracking_event_id` across schemas (`init-db.sql`), seed scripts (`generate_seed.py`, `seed.sql`), ERD (`docs/01-ERD.md`), database seeding analysis (`docs/05-database-seeding-analysis.md`), and low-level designs (`courier-service.md`, `hub-service.md`).
- Fixed table name error in `demo_queries.sql` by renaming `shipping_order_db.ORDER` to `shipping_order_db.SHIPMENT_ORDER`.
- Renamed `STRIPE_TRANSACTION` to `PAYMENT_TRANSACTION` in `docs/05-database-seeding-analysis.md` to match the official schema.
- Updated `ADR-003-shared-db-for-slice.md` to `Accepted` status and updated it to reflect `Schema-per-Service Isolation` instead of logical databases.

### In progress / blocked
-

- Added a "Daily Task Log" rule to `CLAUDE.md`: auto-update `TASKS.md` after completing any non-trivial task, without being asked.
- Committed `cbcfb3c` (`chore: sync local Postgres env and add daily task log`): `docker-compose.yml`, `queries.sql`, `TASKS.md`, `CLAUDE.md`.
- Reviewed Claude Code project setup; found no shared `.claude/settings.json` and no `.gitignore` entry for `.claude/settings.local.json`.
- Ran `fewer-permission-prompts` skill: scanned 27 recent transcripts, added `.claude/settings.json` with `Bash(pnpm test *)`, `Bash(pnpm build *)`, `Bash(pnpm lint *)`, `mcp__claude_ai_Google_Drive__read_file_content`.
- Added `.claude/settings.local.json` to `.gitignore` so it doesn't rely on the machine's global gitignore.
- Committed `a60fb61` (`chore: add shared Claude Code permission allowlist`): `.claude/settings.json`, `.gitignore`, `TASKS.md`.
- Added `.claude/hooks/validate-sql.sh` + `PostToolUse` hook in `.claude/settings.json`: auto-runs `queries.sql` (live, read-only) or `init-db.sql` (against a disposable temp DB) through `shipping_postgres` after every Edit/Write, catching syntax/schema errors immediately. Tested all 3 cases (clean queries.sql, clean init-db.sql, injected error) — works, exit code 2 on failure, no leftover temp DB.
- Investigated `.mcp.json` Postgres MCP server: `@modelcontextprotocol/server-postgres` runs fine but is npm-deprecated ("no longer supported"); alternatives on npm are unverified third parties that would get DB credentials via `npx`. Decided to skip — kept using `docker exec psql` manually instead. No `.mcp.json` added.
- Committed `bdd7636` (`chore: auto-validate queries.sql/init-db.sql via PostToolUse hook`): `.claude/hooks/validate-sql.sh`, `.claude/settings.json`, `TASKS.md`.
- Added `scripts/verify-local.sh`: local-only "CI" (no GH Actions, per instruction — this is a practice project) that brings up the docker-compose stack, reseeds (idempotent, seed.sql TRUNCATEs first), and runs `queries.sql` end to end, failing loudly on the first SQL error. Ran it successfully.
- Added `.claude/agents/consistency-auditor.md`: project-scoped subagent to audit BR/UC/ADR ID drift across docs and ERD/init-db.sql/live-DB/queries.sql drift — modeled directly on the real drift bugs found earlier today (BR-09/BR-10, scan_event_id/tracking_event_id, missing RATECARD versioning columns). Read-only, doesn't edit. Note: new project agents only load on a fresh session — wasn't picked up mid-session, needs a session restart to appear in the agent list.

- Committed `d5643ae` (`chore: add local docker verify script and consistency-auditor agent`): `scripts/verify-local.sh`, `.claude/agents/consistency-auditor.md`, `TASKS.md` — replaces the earlier `77a05d7`, which was undone by a `git reset HEAD~1` before the message got cleaned up.

- Planned Phase 4 (remainder) implementation with `EnterPlanMode`: NestJS monorepo scaffold + shared libs. Resolved ADR-002 (TypeORM, Accepted) and ADR-003 (schema-per-service, Accepted, retitled + migration roadmap added — you edited this directly mid-session) before planning. Corrected the plan twice from review feedback: per-service bootstrap model verified against each LLD (Tracking keeps HTTP, Notification is the only pure/bare app), Pricing is in-process inside `order` (not its own app, per its LLD's "in-process-boundary" rule), NATS uses the raw `nats` client for now (not `@nestjs/microservices` `Transport.NATS`, deferred to Phase 5 pending the JetStream transport decision).
- Created `IMPLEMENTATION_CHECKLIST.md` mirroring the approved plan.
- Split the implementation into 6 sequential MRs/branches off `feat/shipping-system`, each committed:
  - `fix/adr-orm-schema-decisions` (`a9128b6`) — ADR-002 + ADR-003
  - `chore/nestjs-monorepo-skeleton` (`38a34bd`) — nest-cli.json, tsconfig, package.json, eslint/prettier
  - `feat/libs-crypto` (`0140709`) — AES-256-GCM PII helper, TDD red→green
  - `feat/libs-contracts-dtos` (`113f56c`) — 13 NATS event interfaces + subjects map, barcode validator (TDD), Idempotency-Key decorator
  - `feat/scaffold-apps` (`ce6d072`) — all 8 apps, schema-scoped TypeORM, `/health`
  - `chore/phase4-verification` (`bac8f7a`) — approved pnpm build script, full live verification
- Verified live end-to-end: `pnpm build`/`lint`/`test` clean; all 6 DB-backed apps' `/health` hit a real `SELECT 1` on `shipping_postgres` (including `order`'s two connections); `api-gateway` responds with no DB; `notification`'s raw NATS client connects/disconnects cleanly. **Phase 4 (remainder) complete.**
- Merged all 6 branches sequentially (fast-forward, no conflicts) into `feat/shipping-system`, pushed to GitLab `origin` (`5a146b8..ff4ed76`).
- Set up a second remote, **GitHub** (`dunguyen-agilityio/nodejs-training`, fixed from a stale URL that pointed at a different repo): full mirror, everything (code + docs + `.claude`). Pushed `feat/shipping-system` + `main` only (initially pushed all 25 local branches by mistake, then deleted the 23 unrelated ones from GitHub, keeping the 3 pre-existing branches there untouched: `feat/apply-devops`, `feat/demo-build-preview-api`, `feat/orbit-logistic-with-datagrip`).
- For **GitLab**: considered rewriting history with `git filter-repo` to strip `docs/`/`.claude/` retroactively, but that would force every future GitLab push to require `--force` forever (local keeps full content, so a normal push would just re-add them) — declined once that consequence was clear. Went with the sustainable option instead: a second local branch forked from `feat/shipping-system` with `docs/` and `.claude/` removed (`aa9d282`), pushed to GitLab as a **new** branch (no force needed, no history rewritten). GitLab's original `feat/shipping-system` (full, already has docs/.claude from earlier pushes) is left as-is/frozen.
- Renamed that branch from `feat/shipping-system-code-only` to `supporter-review`, then realized the naming should live at the **remote** level (GitLab = supporter-review remote), not the branch name. Final state: **force-pushed the code-only content over GitLab's `feat/shipping-system`** (same branch name as GitHub, `ff4ed76..aa9d282`) and deleted the now-redundant `supporter-review` branch from GitLab. GitLab's `feat/shipping-system` no longer has the old full history with docs/.claude — that's gone from GitLab for good (still intact on GitHub and locally).
- Also stripped `.gemini/` (a different AI tool's config, not just `.claude/`) from the `supporter-review` branch (`564a1e3`) and force-pushed again to GitLab's `feat/shipping-system` (`aa9d282..564a1e3`). Verified live via `git fetch` + `git ls-tree` against GitLab: no `docs/`, `.claude/`, or `.gemini/` present there.
- **Going forward**: `feat/shipping-system` means different content per remote — GitHub's has everything (code + docs + `.claude`); GitLab's is code-only. Same local setup: `feat/shipping-system` (full) pushes to `github`, `supporter-review` (code-only) force-pushes to `origin` under the *same remote branch name* `feat/shipping-system` (`git push origin supporter-review:feat/shipping-system --force`) — force required every time, since `supporter-review` needs to be re-synced from `feat/shipping-system` and re-stripped each time, not automatic.
- **Fixed a footgun**: local `feat/shipping-system` was still tracking `origin` (GitLab) by default from before the split — since GitLab's `feat/shipping-system` now has different (stripped) content, a plain `git push`/`git pull` on this branch would conflict or, worse, silently overwrite GitLab's code-only state if force-pushed by habit. Re-pointed its upstream to `github/feat/shipping-system` (`git branch --set-upstream-to`) so the default push target is now correct.
- Documented the whole dual-remote workflow (push commands, how to re-sync `supporter-review`, the upstream-tracking footgun) as a permanent "Git Remotes" section in `CLAUDE.md` (`883e922`), plus fixed ADR-002's stale "NOT yet decided" note. Pushed both: GitHub `feat/shipping-system` (`ff4ed76..883e922`) and GitLab `feat/shipping-system` via `supporter-review` sync (`564a1e3..c330a9c`) — verified again via `git ls-tree` that GitLab still has no `docs/`/`.claude/`/`.gemini/`.

### Decisions / open questions
- `docker-compose.yml` is new/untracked — not yet added to git, pending your call.
- None of the 6 Phase-4 MR branches have been merged into `feat/shipping-system` or pushed yet — sitting locally as sequential branches (each based on the previous).

### Next
- Merge/push the 6 MR branches (or open MRs on GitLab) once you've reviewed them.
- Phase 5 (Core Backend, `docs/03-phases.md`): Order Service entities/DTOs/order-creation logic, Parcel state machine, Pricing module (in-process), Tracking event store, `@nestjs/microservices`/JetStream consumer wiring.
