---
description: Load one numbered task from docs/03-phases.md and begin it following project conventions
argument-hint: <task number e.g. "5.1">
---

You are beginning task **$1**.

1. Read `docs/PROGRESS.md` (Resume point) and the tail of `TASKS.md` (most recent
   dated entry) to recover where the last session left off.
2. Find task **$1** in `docs/03-phases.md` (format `<phase>.<task>`, e.g. `5.1`).
   Restate its scope, which BR-IDs / UC-IDs / entities it touches
   (cross-reference `docs/04-business-rules.md` and the relevant
   `docs/lld/*.md` file), and what "done" means for it, in 3-5 bullets. If $1
   doesn't match a numbered task, stop and ask — don't guess which bullet was
   meant.
3. Re-read `docs/lld/00-conventions.md` and the specific service's LLD file for
   the API contracts, error envelope, and DB constraints this task must
   satisfy.
4. Propose the implementation plan as a numbered list (files to add/change,
   tests to write first per the TDD rule in `docs/lld/00-conventions.md`). Then
   write **exactly this line and stop**:
   > Plan ready — reply "go" to begin coding.
   Do not write any code, create any file, or run any command until the user
   replies.
5. Implement only this task. Do not start adjacent tasks, even ones in the
   same phase. Follow `CLAUDE.md` guardrails: no `any`, no new abstractions
   beyond what's needed, thin controllers, TDD red-green-refactor, money in
   cents, timestamps in UTC.
6. Adding a dependency or touching another app beyond this task's scope
   requires asking first, per `CLAUDE.md`'s decision authority table.

Do not mark anything done in `TASKS.md` yet — that happens in `/wrap-task`.
