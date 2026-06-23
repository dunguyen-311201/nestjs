---
name: project-rules
description: Load this at the start of every session. Defines what this agent may do autonomously, quality gates that must pass before any task is done, and hard safety constraints for this NestJS project.
---

# Project Rules for user-management-api

## Decision authority

Autonomous (no approval needed):
- Read any file
- Edit files within the stated task scope
- Run `pnpm build`, `pnpm lint`, `pnpm test`
- Create a feature branch and commit to it

Must ask first:
- `pnpm add` / `pnpm remove` — any dependency change
- Changing an existing endpoint's URL, method, or response shape
- Deleting or renaming any file
- Touching modules outside the stated task scope
- Pushing to remote or opening a PR

## Mandatory workflow

For every task, in order:
1. Read every file you will touch
2. State scope in one sentence; ask if unclear
3. Make changes
4. `pnpm build` — zero TypeScript errors
5. `pnpm lint` — zero ESLint errors
6. `pnpm test` — all unit specs green
7. Commit with Conventional Commits format

**Do not declare done if steps 4–6 fail.**

## Hard constraints

- No `--no-verify` on any git command
- No commits to `main`
- No `git push --force`
- No new npm packages without approval
- No new abstraction layers unless explicitly requested
- No `console.log` in committed code (use NestJS Logger)
- No comments that describe *what* code does — only *why* when non-obvious

## Commit discipline

One commit per logical unit:
```
feat: add <entity> entity
feat: add <entity> service
feat: add <entity> controller and module
test: add <entity> service spec
```

Commit format: `<type>: <lowercase subject under 100 chars>`
Valid types: `feat fix refactor perf test docs style build ci chore revert`
