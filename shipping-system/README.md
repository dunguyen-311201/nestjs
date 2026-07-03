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
- `docs/adrs/` — ADR-001 through ADR-004

Scope: bags & manifests are physical-only (NOT modeled). Tracking is parcel-level.
All documents are synchronized to this scope — no contradictions remain. Rule Catalogue and
NFR tables each live in exactly one file; other docs link to them instead of duplicating.
