---
description: Run the quality gate, update progress docs, and summarize the task for review
---

Finish the current task:

1. Run `pnpm build`, `pnpm lint`, and `pnpm test` (the Quality gate in
   `CLAUDE.md`). If anything fails, fix it — do not weaken a rule, skip a test,
   or use `--no-verify` to make it pass. Re-run until all three are green.
2. Confirm every business rule / use case this task touched actually has a
   test for both the happy path and the guard-failure (`422` with
   `{ rule: "BR-XX", message }`) per the TDD rule in `docs/lld/00-conventions.md`.
   If coverage is missing, add it — do not mark the task done with gaps.
3. Update `TASKS.md`: add or append to today's `## YYYY-MM-DD` entry with terse
   `Done` bullets referencing files/BR/UC IDs, per the existing convention.
4. Update `docs/PROGRESS.md`:
   - Move the **Resume point** to the next phase item / task.
   - Add a dated log entry: what changed, decisions made, tests added,
     follow-ups or known gaps.
5. If you made a notable choice (a new dependency, a pattern, a tradeoff) that
   isn't already covered by an existing ADR, flag it — don't add a new ADR file
   silently, confirm the decision with the user first per `CLAUDE.md`.
6. Produce a concise review summary: files changed, key decisions, how to
   verify, and anything that needs attention. **Do not start the next task.**
