# Daily Task Log

One entry per day. Add a new `## YYYY-MM-DD` section at the top (newest first).
End of day, copy the "Done" bullets straight into your report.

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
- Reviewed `docs/01-ERD.md` PARCEL vs PROOF_OF_DELIVERY cardinality; confirmed `1:0..1` is correct per BR-04 (RTS only fires after failed attempts, never after a successful `Delivered`).
- Added deferred/out-of-scope notes for a possible future "post-delivery return" flow in `docs/01-ERD.md` and `docs/04-business-rules.md`.
- Added zone-to-zone pricing queries (current rate-card price vs. locked order price) to `queries.sql`.
- Reviewed all queries in `queries.sql` against BRs/NFRs/use cases; fixed several bugs (artificial `LIMIT 5` hiding SLA violations, `INNER JOIN` dropping never-scanned parcels, wrong revenue filter, mislabeled `outcome` column) and added missing coverage (UC-04 order-level aggregation, BR-08 payment-gate audit, BR-06 weight-discrepancy audit, POD completeness check).
- Discovered the running `shipping_postgres` container's schema was stale vs. `init-db.sql` (missing `outcome`, `effective_from`/`effective_to`, wrong FK column name on `PROOF_OF_DELIVERY`).
- Recreated `docker-compose.yml` (postgres + redis + nats, was missing from disk), rebuilt the postgres volume so `init-db.sql` applies cleanly, and reseeded from `seed.sql`.

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

### Decisions / open questions
- `docker-compose.yml` is new/untracked — not yet added to git, pending your call.

### Next
-
