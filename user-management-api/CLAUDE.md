# user-management-api

NestJS 11 REST API (training project). Users, products, and categories with TypeORM + SQLite.

---

## Agent Rules

These rules govern how AI agents work in this project. They override default agent behaviour.

### Decision authority

| Action | Autonomous | Must ask first |
|---|---|---|
| Read any file | ✅ | |
| Edit files matching the task scope | ✅ | |
| Run `pnpm test`, `lint`, `build` | ✅ | |
| Create a feature branch | ✅ | |
| Commit on the current branch | ✅ | |
| Add a new npm dependency | | ✅ |
| Change an existing endpoint's URL, method, or response shape | | ✅ |
| Delete or rename a file | | ✅ |
| Touch more than one module beyond what was asked | | ✅ |
| Push to remote / open a PR | | ✅ |

### Workflow — required steps for every task

1. **Read before writing** — read every file you will modify before touching it.
2. **State scope** — one sentence: what files change and why. If scope is unclear, ask.
3. **Build first** — run `pnpm build` after any structural change (new file, renamed import, new decorator).
4. **Lint** — run `pnpm lint` after all edits; zero errors required.
5. **Test** — run `pnpm test`; all specs must be green before declaring done.
6. **Commit** — one commit per logical unit following Conventional Commits (see Git Conventions).

Never declare a task complete if any of steps 3–5 fails.

### Code guardrails

- **Match existing style** — before writing new code in a file, read the whole file and mirror its style exactly.
- **No new abstractions** — don't introduce a helper, base class, or utility unless the task explicitly requires it.
- **No new packages** — do not run `pnpm add` without explicit user approval.
- **No comments** — only add a comment when the *why* is non-obvious. Never comment *what* the code does.
- **No `any`** — use `unknown`, a proper type, or a typed interface. `no-explicit-any` is off in ESLint but that's a last resort, not a default.
- **No dead code** — don't leave `console.log`, commented-out blocks, or TODO stubs in committed code.
- **Thin controllers** — business logic belongs in the service, never in the controller.
- **One responsibility per commit** — entity change = one commit; service change = one commit; tests = one commit. Don't bundle unrelated changes.

### Git rules for agents

```
# Before starting any multi-file task:
git checkout -b <type>/<description>

# One commit per logical unit:
git commit -m "feat: add order entity"
git commit -m "feat: add orders service"
git commit -m "feat: add orders controller and module"
git commit -m "test: add orders service spec"
```

- **Never** use `--no-verify` (hooks exist for a reason)
- **Never** commit directly to `main`
- **Never** `git push --force`
- **Never** amend a commit that has already been logged (create a new one)

### When to ask, not act

Ask the user before proceeding when:
- Requirements are ambiguous — describe what you understood and ask for confirmation
- A file you need to edit is outside the stated task scope
- The fix requires changing a public API contract
- You discover the problem is deeper than the original request describes
- Any irreversible action (delete, rename, drop column) is needed

### Quality gate — non-negotiable before "done"

```bash
pnpm build   # zero TypeScript errors
pnpm lint    # zero ESLint errors
pnpm test    # all unit specs green
```

If any gate fails and you cannot fix it within the task scope, report the failure explicitly — do not paper over it.

---

## Stack
- NestJS 11, TypeScript 5
- TypeORM 1 + better-sqlite3 (`database.sqlite`, `synchronize: true` — no migrations needed)
- class-validator + class-transformer for request/response shaping
- pnpm workspace
- Jest (unit) + Supertest (e2e)

## Dev Commands
```bash
pnpm start:dev    # watch mode, port 3000
pnpm test         # unit tests (src/**/*.spec.ts)
pnpm test:cov     # coverage report
pnpm test:e2e     # e2e tests (test/**/*.e2e-spec.ts)
pnpm lint         # ESLint + Prettier --fix
pnpm build        # compile to dist/
```

## Module Layout

Each domain in `src/<domain>/`:
```
src/<domain>/
  entities/<domain>.entity.ts     # TypeORM entity
  dto/create-<domain>.dto.ts      # required fields
  dto/update-<domain>.dto.ts      # all fields @IsOptional()
  dto/<domain>-query.dto.ts       # pagination/filter (only if needed)
  dto/<domain>-response.dto.ts    # output shaping with @Expose/@Transform (only if needed)
  <domain>.controller.ts
  <domain>.service.ts
  <domain>.module.ts
  <domain>.controller.spec.ts
  <domain>.service.spec.ts
```

Register every new module in `src/app.module.ts` imports array and add its entities to the TypeORM entity list.

## Global Infrastructure (`src/common/`)
| File | Purpose |
|---|---|
| `filters/http-exception.filter.ts` | Formats all HTTP error responses |
| `interceptors/logging.interceptor.ts` | Logs request + response |
| `middleware/logging.middleware.ts` | Logs incoming requests |
| `guards/mock-auth.guard.ts` | Requires `Authorization: Bearer mock-token` |

All registered globally in `main.ts` / `app.module.ts`. Do not duplicate them per-module.

## API Conventions
- URI versioning: prefix `v`, default `1` → `GET /v1/users`
- Controller: `@Controller({ path: 'resource', version: '1' })`
- Auth: `@UseGuards(MockAuthGuard)` at controller class level (all routes require `Authorization: Bearer mock-token`)
- 404 pattern: services throw `NotFoundException('X not found')` — no custom error classes

## TypeORM Entity Conventions
```ts
@PrimaryGeneratedColumn('uuid') id!: string;
@CreateDateColumn() createdAt!: Date;
@UpdateDateColumn() updatedAt!: Date;
// nullable: @Column({ type: 'text', nullable: true }) field!: string | null;
// ManyToOne: { nullable: true, eager: false }
```

## DTO Conventions
- Create DTOs: `@IsNotEmpty()` on required, `@IsOptional()` on optional
- Update DTOs: every field is `@IsOptional()`
- ValidationPipe runs with `whitelist: true` — unknown fields are stripped automatically
- Response DTOs: use `@Expose()` + `plainToInstance(ResponseDto, entity, { excludeExtraneousValues: true })`

## Entities & Relations
- **User**: id, name, email (unique), avatarUrl (nullable)
- **Category**: id, name (unique), description (nullable), products[]
- **Product**: id, name, description, price (decimal 10,2), stock (int, default 0), category (ManyToOne → Category, nullable)

## Test Conventions
- Unit specs colocated: `src/<domain>/<file>.spec.ts`
- Use `@nestjs/testing` `TestingModule` with mocked repositories via `getRepositoryToken`
- E2E: `test/app.e2e-spec.ts`, pass `Authorization: Bearer mock-token` on every request
- HTTP samples: `test/api.http` (VS Code REST Client format)

## Git Conventions

### Branch naming
```
feat/<short-description>       # new feature
fix/<short-description>        # bug fix
refactor/<short-description>   # restructure without behavior change
test/<short-description>       # test-only changes
docs/<short-description>       # documentation only
chore/<short-description>      # tooling, deps, config
```
Examples: `feat/order-module`, `fix/product-price-validation`, `refactor/users-service`

### Commit messages — Conventional Commits
```
<type>: <short description in lowercase>

[optional body — explain WHY, not what]
[optional footer — BREAKING CHANGE: ..., Closes #123]
```

**Allowed types:**
| Type | When to use |
|---|---|
| `feat` | New endpoint, new module, new behaviour |
| `fix` | Bug fix |
| `refactor` | Code change that doesn't add features or fix bugs |
| `perf` | Performance improvement |
| `test` | Add or update tests only |
| `docs` | Documentation only |
| `style` | Formatting, whitespace — no logic change |
| `build` | Build scripts, deps, pnpm |
| `ci` | CI/CD config |
| `chore` | Maintenance not fitting above categories |
| `revert` | Reverts a previous commit |

**Rules enforced by commitlint:**
- Subject must be lowercase
- Subject max 100 chars
- No period at end of subject
- Breaking changes: add `BREAKING CHANGE:` footer or `!` after type — `feat!: rename user endpoint`

**Good examples:**
```
feat: add pagination to products endpoint
fix: throw NotFoundException when category not found
refactor: extract price formatting into helper
test: add service spec for order module
chore: upgrade typeorm to v1.1
```

**Bad examples (will be rejected):**
```
Added stuff                          # no type
feat: Added pagination               # uppercase
feat: add pagination to products.    # trailing period
WIP                                  # no type, too vague
```

## Code Style

### Prettier (`.prettierrc`)
- Single quotes, trailing commas, 100-char line width, LF line endings
- Run `pnpm format` to format all files

### ESLint (`eslint.config.mjs`)
Key rules beyond TypeScript defaults:
- `no-console`: warn (use logger/interceptor instead of raw `console.log`)
- `eqeqeq`: always use `===`
- `consistent-type-imports`: use `import type` for type-only imports
- `no-floating-promises`: error — always `await` or `void` async calls

### TypeScript
- `strictNullChecks: true` — no implicit nulls
- Prefer `const` over `let`; never use `var`
- Use `!` non-null assertion only when you're certain (e.g. TypeORM-populated fields on entity classes)

## Git Hooks (husky)

`pre-commit` — runs `lint-staged`:
- ESLint --fix + Prettier on `src/**/*.ts`
- Prettier on `test/**/*.ts`

`commit-msg` — runs commitlint:
- Rejects commits that don't follow Conventional Commits format

## What NOT to do
- Do not add a database migration setup — `synchronize: true` handles schema in dev
- Do not add a global auth module — `MockAuthGuard` is intentionally simple for training
- Do not add Swagger unless asked — keep dependencies minimal
- Do not use `@nestjs/config` unless asked — no `.env` file yet
- Do not bypass hooks with `--no-verify` — fix lint errors instead
