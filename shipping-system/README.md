# Agent Context — Shipping System (scoped slice)

Load `CLAUDE.md` first (authoritative). All docs below are consistent with the scoped slice.

- `CLAUDE.md` — scope, architecture decisions, conventions, open decisions
- `docs/01-ERD.md` — data model (13 entities)
- `docs/02-HLD.md` — services, NATS subject map, REST endpoints
- `docs/03-phases.md` — 16-day phase plan
- `docs/04-business-rules.md` — business rules (BR-03..10) + parcel lifecycle
- `diagrams/ERD_v4_scoped.mmd` — ERD in Mermaid

Scope: bags & manifests are physical-only (NOT modeled). Tracking is parcel-level.
All documents are synchronized to this scope — no contradictions remain.
