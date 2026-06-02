# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Commands

| Task | Command |
|------|---------|
| Start (dev/watch) | `pnpm start:dev` |
| Build | `pnpm build` |
| Run all tests | `pnpm test` |
| Run single test file | `pnpm test -- --testPathPattern=<filename>` |
| E2E tests | `pnpm test:e2e` |
| Format | `pnpm format` |
| Lint (auto-fix) | `pnpm lint` |

## Architecture

`AppModule` (root) imports `UsersModule`. That's the only feature module currently.

**`UsersModule`** wires together:
- **`UsersController`** — CRUD endpoints at `/users`; `MockAuthGuard` and `HttpExceptionFilter` applied at the controller level
- **`UsersService`** — in-memory store (`private readonly users: any[]`), no database; IDs generated via `Date.now()`
- **`LoggingMiddleware`** — registered in `UsersModule.configure()` for all methods on the `users` path

**Request pipeline for `/users` routes:**
`LoggingMiddleware` → `MockAuthGuard` → route handler → `HttpExceptionFilter` (on exception)

**Auth:** All `/users` routes require the header `authorization: mock-token`. The guard throws `UnauthorizedException` on anything else. This is a learning stub, not real auth.

## Code Style

See `.claude/skills/code-style/SKILL.md` for full Prettier and ESLint rules. Short version: single quotes, trailing commas everywhere, run `pnpm lint` before committing.
