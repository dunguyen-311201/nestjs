# Reference

Raw source artifacts and archived internal planning docs — kept as-received
or as-completed, not synthesized or maintained going forward. If a document
here conflicts with `docs/01-ERD.md` through `docs/06-specification.md`, the
numbered docs win; this folder is provenance, not the authoritative spec.

- [`phase-4-implementation-checklist.md`](phase-4-implementation-checklist.md)
  — Phase 4 scaffold checklist, 100% complete, archived. Current phase status
  lives in `docs/PROGRESS.md`, not here.
- [`task-5.1-walkthrough.md`](task-5.1-walkthrough.md) — step-by-step
  explainer for task 5.1's review, written in Vietnamese with English
  technical keywords kept (per user preference — see
  [[feedback_commit_granularity_and_walkthrough]] in agent memory).
  Temporary — delete once reviewed.
- [`task-5.2-walkthrough.md`](task-5.2-walkthrough.md) — same format,
  for task 5.2 (BusinessRuleException + ParcelStateMachine). Temporary —
  delete once reviewed.
- [`task-8.1-rule-tests-audit.md`](task-8.1-rule-tests-audit.md) — BR-01
  through BR-09 traced to their implementation guard and unit test file,
  produced for task 8.1. Kept as a point-in-time audit record — re-verify
  against the live test suite before relying on it, since file paths/line
  numbers drift as the code changes.

When a new raw artifact shows up (an original DDL export, a client-provided
diagram source, a requirements doc) or a planning doc is fully done and no
longer active, put it here instead of the top-level `docs/` folder, and link
to it from whatever doc supersedes it.
