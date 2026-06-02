---
name: code-style
description: Use when writing, editing, or reviewing TypeScript code in this project. Defines Prettier formatting rules, ESLint rules, and how to run format and lint commands.
---

# Code Style

## Prettier Rules

Config lives in `.prettierrc`. Rules enforced as ESLint errors (`prettier/prettier: error`).

| Rule | Value |
|------|-------|
| `singleQuote` | `true` — use `'` not `"` |
| `trailingComma` | `"all"` — trailing commas everywhere (args, arrays, objects) |
| `endOfLine` | `"auto"` — respects OS line endings |

**Examples:**
```typescript
// ✅ Correct
import { Injectable } from '@nestjs/common';

const user = {
  id: 1,
  name: 'Alice',
};

function greet(
  name: string,
  greeting: string,
) {}

// ❌ Wrong
import { Injectable } from "@nestjs/common";
const user = { id: 1, name: "Alice" }
```

## ESLint Rules

Config lives in `eslint.config.mjs`. Extends:
- `@eslint/js` recommended
- `typescript-eslint` recommendedTypeChecked
- `eslint-plugin-prettier/recommended`

| Rule | Level | Notes |
|------|-------|-------|
| `@typescript-eslint/no-explicit-any` | off | `any` is allowed |
| `@typescript-eslint/no-floating-promises` | warn | Always `await` or `void` promises |
| `@typescript-eslint/no-unsafe-argument` | warn | Avoid passing `any` to typed params |
| `prettier/prettier` | error | All formatting is enforced |

**Floating promise — common warning:**
```typescript
// ⚠️ Triggers warning
someAsyncFn();

// ✅ Fix
await someAsyncFn();
// or
void someAsyncFn();
```

## Commands

| Task | Command |
|------|---------|
| Format all files | `pnpm format` |
| Lint and auto-fix | `pnpm lint` |
| Check without fixing | `pnpm eslint "{src,apps,libs,test}/**/*.ts"` |

Always run `pnpm lint` before committing. CI will fail on `prettier/prettier` errors.

## Common Mistakes

| Mistake | Fix |
|---------|-----|
| Double quotes `"string"` | Use single quotes `'string'` |
| Missing trailing comma | Add `,` after last item in multi-line object/array/args |
| Unhandled promise (floating) | `await` or prefix with `void` |
| Using `any` in a typed context | Acceptable here — `no-explicit-any` is off |
