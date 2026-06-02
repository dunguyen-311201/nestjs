# Stack

## Runtime & Language
- **Node.js** with **TypeScript 5.7**
- **NestJS 11** on **Express** (`@nestjs/platform-express`)
- Package manager: **pnpm**

## Testing
- **Jest 30** — unit tests (`*.spec.ts` in `src/`)
- **Supertest** — e2e tests (`test/*.e2e-spec.ts`)
- `ts-jest` for TypeScript transformation
- `@nestjs/testing` for module bootstrapping in tests

## Tooling
- `@nestjs/cli` — code generation and build (`nest build`, `nest start`)
- **ESLint** with `typescript-eslint` + `eslint-plugin-prettier`
- **Prettier** — formatting enforced as ESLint errors

## Current Storage
In-memory array in `UsersService` — no database, no ORM. Data resets on each restart.

## Key Versions
| Package | Version |
|---------|---------|
| `@nestjs/common` | ^11 |
| `typescript` | ^5.7 |
| `jest` | ^30 |
| `ts-jest` | ^29 |
