# Shipping System — Project Context for AI Agent

Domestic parcel shipping system (hub-and-spoke, modeled on GHN/GHTK/J&T).
Backend vertical slice, NestJS microservices, NATS JetStream event backbone.
**All deliverables (code, docs, comments) in English.**

## SCOPE — Scoped Slice (read this first)

This is a deliberately reduced scope to fit a 16-day timeline. Payment (BR-08) and Notification (BR-09) were added later and absorbed into the same 16.0d by trimming HLD/ADR write-up and Integration/Testing polish — see `docs/03-phases.md` for the exact trade-offs. COD Settlement was completely removed. Do NOT reintroduce cut features.

**In scope:** Order → Parcel → parcel-level tracking (append-only TrackingEvent) → payment (price locked at creation) → hub + line-haul transport → delivery / RTS / terminal states → PII encryption.

**CUT (physical-only, NOT modeled in the database):**
- **Bags and Manifests** — these are physical actions by hub staff (parcels put in sacks, loaded on trucks). The system does NOT model them as entities/tables.
- Consolidation / deconsolidation logic
- Manifest shortage/overage reconciliation
- Polymorphic TrackingEvent (TrackingEvent references parcel_id only)
- Multi-level scanning

**Consequence to remember:** a lost parcel is detected passively (never scanned at the next hub), not by an active manifest count.

## Architecture decisions (do not contradict)

- **Concurrency:** per-aggregate serialization via NATS JetStream per-order subject `shipment_orders.status.<shipment_order_id>`. JetStream in-subject ordering serializes writes to one order; different orders run in parallel. NO BullMQ.
- **Redis:** read cache only (hot projections for < 300ms P99). NOT a broker or job queue.
- **Cross-service references:** plain IDs, NOT foreign keys. FKs never span service databases. Within the shared-DB slice, FKs may exist only within one service's schema.
- **Event store:** TrackingEvent is append-only and the source of truth. Parcel state and location are COMPUTED from the event sequence, never stored as editable columns.
- **SHIPMENT_ORDER.status:** materialized write-back projection = least-advanced status of the order's parcels (BR-05). Written async via the JetStream per-shipment-order subject.
- **Outbox pattern:** used for Order Creation (Order Service) only. (Manifest sealing was cut with manifests.)
- **Notifications:** a stateless Notification consumer (owns no table, no outbox) subscribes to `order.created`, `payment.succeeded`, `parcel.delivered`, `parcel.rts`, `parcel.lost_suspected` and sends best-effort email. A send failure is logged and dropped — it must never block, retry, or roll back the triggering transaction (BR-09).
- **Idempotency (two layers):** (1) outbox worker sets NATS header `Nats-Msg-Id = event_id` → JetStream dedup window drops duplicates at the broker; (2) consumers also de-dup on event_id.
- **TDD Enforcement:** All microservices and business guards must be implemented using a strict Test-Driven Development (TDD) cycle (Red-Green-Refactor). Write tests first to cover the use case/rule requirements, verify they fail, then implement the minimal code required to pass, and refactor.


## Conventions

- Money = integer **cents**. Weight = integer **grams**. Timestamps = **UTC**.
- IDs = uuid.
- PII (name, phone, address) = field-level encrypted at rest via the shared `crypto/` helper. Region/postal code stays plaintext for routing.
- Barcode formats: Parcel `PA-XXXX`, (Manifest `MN-XXXX` is out of scope now).

## Monorepo shared library — 3 partitions

- `contracts/` — TypeScript interfaces / JSON Schemas for NATS events (e.g. OrderCreatedEventV1, ParcelDeliveredEventV1). One source of truth for event shape. Versioned: v2 added alongside v1, never edited in place.
- `dtos/` — shared validation classes and rules (barcode formats, common request DTOs).
- `crypto/` — field-level encrypt/decrypt helpers for PII. Reused by Order and Courier services.

## Open decisions (confirm before relying on)

- RateCard versioning (append-only?) — deferred; rely on locked price_cents for now.

## Decided

- **ADR-002 ORM:** TypeORM (Accepted). Use `@nestjs/typeorm` + `@InjectRepository`; each service's `DataSource` is scoped to its own Postgres schema via TypeORM's `schema` option (not a separate `database`) — see ADR-003.

## Git Remotes — dual push, different content per remote

Two remotes, same local branch name (`feat/shipping-system`) means **different content** on each:

| Remote | URL | Content | Local branch that feeds it |
| :--- | :--- | :--- | :--- |
| `github` | `dunguyen-agilityio/nodejs-training` | **Full** — code + `docs/` + `.claude/` | `feat/shipping-system` (tracks `github/feat/shipping-system`) |
| `origin` | GitLab, `du.nguyen/nodejs-training` | **Code only** — no `docs/`, `.claude/`, or `.gemini/` | `supporter-review` (local-only branch, never tracks a remote by the same name) |

Why: GitLab is the supporter-review remote — reviewers there should see code only, not internal docs or AI agent config. GitHub is the personal full mirror/backup.

**Push commands:**
- Full → GitHub: `git push github feat/shipping-system` (normal push, branch tracks this already).
- Code-only → GitLab: `git push origin supporter-review:feat/shipping-system --force` (force is required every time — `supporter-review`'s content diverges from GitLab's `feat/shipping-system` by design, this is expected, not a mistake).

**Keeping `supporter-review` in sync** (do this before the force-push above, whenever `feat/shipping-system` has new commits):
```
git checkout supporter-review
git merge feat/shipping-system --no-commit   # modify/delete conflicts under docs/ are expected; the rm below resolves them
git -C "$(git rev-parse --show-toplevel)" rm -rf --quiet shipping-system/docs shipping-system/.claude shipping-system/.gemini
git ls-files | grep -E "docs/|\.claude|\.gemini" && echo "STOP: strip incomplete" || git commit -m "chore: sync + strip docs/.claude/.gemini for GitLab"
git push origin supporter-review:feat/shipping-system --force
git checkout feat/shipping-system
```

Recipe footguns (each bit above exists because it went wrong once):
- The `git -C <repo-root>` prefix is required: the paths are repo-root-relative, and running the plain `git rm shipping-system/...` from inside `shipping-system/` silently matches nothing (the old `2>/dev/null` hid exactly that failure, leaking docs to GitLab).
- `-rf` (not `-r`): a file both deleted on `supporter-review` and modified on `feat/shipping-system` is left unmerged by the merge, and plain `-r` refuses to remove it.
- The `git ls-files | grep` guard verifies zero stripped-pattern paths remain tracked before committing — never skip it.
Not automated — do this by hand (or when asked) each time before pushing to GitLab.

**Footgun already fixed once, don't reintroduce it:** local `feat/shipping-system` must track `github`, not `origin` — its upstream was originally `origin` (from before the dual-remote split) and got corrected via `git branch --set-upstream-to=github/feat/shipping-system feat/shipping-system`. If a plain `git push`/`git pull` on this branch ever shows `origin` as the upstream again, re-fix it — pushing full content to GitLab's code-only branch name would silently undo the split.

## Environment note

VS Code installed via snap creates a sandboxed terminal with a different `$HOME`, causing pnpm version mismatch and `nest new` failures. Use a system terminal (not the snap VS Code integrated terminal), or npm as fallback.

## Docs

- `docs/01-ERD.md` — 16 entities, relationships, design notes (scoped slice)
- `docs/02-HLD.md` — services, NATS subject map, REST endpoints
- `docs/03-phases.md` — estimation: timeline, actor coverage, roadmap, 16-day phase plan
- `docs/04-business-rules.md` — the single authoritative Rule Catalogue (BR-01–BR-09); other docs link here instead of duplicating it
- `docs/05-analysis.md` — original pre-scope-cut analysis, kept for historical context only (do not build against it)
- `docs/06-specification.md` — scoped-slice specification; also the canonical home for Non-Functional Requirements
- `docs/07-e2e-walkthrough.md` — full end-to-end vertical-slice walkthrough (order → payment → hub → line-haul → dispatcher → courier → tracking → notification) against the dockerized stack, every command's output actually captured, not hypothetical; documents a real gap found while writing it (`PARCEL.state` can't reach `Delivered` through the full multi-hub flow yet)
- `docs/08-architecture-patterns.md` — catalogue of recognized architecture patterns actually implemented (Dependency Inversion, Event Store/CQRS, Transactional Outbox, Idempotency-Key, Circuit Breaker, API Gateway, Database-per-Service, Saga-style compensation, per-aggregate serialization), each with a real file reference — written after cross-checking this project against two architecture books
- `docs/09-real-integrations-guide.md` — how to switch from local simulation to real external providers: Stripe test-mode payments (keys, Stripe CLI webhook tunnel, checkout flow) and Resend/SendGrid email via the Notification service's `IEmailProvider` adapters (env-var selection, no SDK dependency, verification steps)
- `docs/lld/` — one self-contained file per service: Versioning, Key Design Decisions, Use Cases, Sequence Diagrams, API DTOs/validation/error codes, DB indexes/constraints. `00-conventions.md` first (shared rules), then per-service files. No separate top-level use-case/sequence-diagram doc — each service's are embedded in its own LLD file to avoid a second copy drifting out of sync.

All docs are synchronized to the scoped slice. Any remaining mention of bags/manifests is an explicit "out of scope / not modeled" note, not a feature to build.

## Daily Task Log

`TASKS.md` (project root) tracks what gets done each day so it can be copied straight into an end-of-day report.

- After completing any non-trivial task in a session (a fix, a review, a file created/edited, a decision made), update today's entry in `TASKS.md` **automatically, without being asked** — append a bullet under **Done** (or **Decisions / open questions** / **Next** as appropriate).
- If there's no section for today yet, add a new `## YYYY-MM-DD` block at the top of the file (newest first), using the template comment already in `TASKS.md`.
- Keep bullets terse — one line per completed item, referencing files/BR/UC IDs where relevant. This is a log for recall, not a design doc.
