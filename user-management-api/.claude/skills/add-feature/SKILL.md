---
name: add-feature
description: End-to-end workflow for adding a non-trivial feature (not a whole module) to an existing resource — e.g. pagination, filtering, a new endpoint, bulk operations.
---

# Adding a Feature to an Existing Resource

Use this when extending something that already exists (controller, service, entity).

## Step 1 — Understand scope

Read the relevant controller, service, and entity files.
Identify what already exists so you don't duplicate it.
Confirm the exact behaviour with the user before writing any code.

## Step 2 — Write the spec (for non-trivial features)

Save a short spec to `docs/specs/YYYY-MM-DD-<feature>.md`:
- What endpoint/behaviour changes
- Input/output contract
- Edge cases and error conditions
- What stays the same

Show it to the user and get approval before coding.

## Step 3 — Update DTOs first

Add new fields to existing DTOs or create new ones.
Run `pnpm build` — TypeScript must compile before touching service/controller.

## Step 4 — Update the service

Business logic lives in the service, not the controller.
Keep controllers thin: they parse params and delegate.

## Step 5 — Update the controller

Add the new endpoint or modify the existing one.
Follow: `@Controller({ path: 'resource', version: '1' })` — do not change the version for backwards-compatible changes.

## Step 6 — Tests

Write or update specs:
- Unit test the service method directly
- Unit test the controller method (mock the service)
- Add an HTTP sample to `test/api.http`

Run `pnpm test` — all must pass.

## Step 7 — Build check

```bash
pnpm build
```

No TypeScript errors before marking the feature done.
