---
name: github-conventions
description: Use when naming branches, writing commit messages, creating merge request descriptions, or reviewing code on GitHub. Covers branch prefixes, Conventional Commits format, MR description template, and code review checklist.
---

# GitHub Conventions

## Branch Naming

**Format:** `<type>/<short-description>`

| Prefix | When to use |
|--------|-------------|
| `feat/` | New feature or enhancement |
| `fix/` | Bug fix |
| `learn/` | Learning, exploration, spike |
| `chore/` | Maintenance, config, deps, tooling |

**Rules:**
- Use kebab-case: `feat/user-authentication` not `feat/userAuthentication`
- Keep description short (2–5 words)
- No uppercase, no spaces, no special chars except `-`

**Examples:**
```
feat/user-authentication
fix/login-redirect-loop
learn/nestjs-guards
chore/update-dependencies
```

## Commit Messages

Follow **Conventional Commits** format:

```
<type>(<scope>): <short description>

[optional body]

[optional footer]
```

| Type | When to use |
|------|-------------|
| `feat` | New feature |
| `fix` | Bug fix |
| `refactor` | Code change that neither fixes a bug nor adds a feature |
| `test` | Adding or updating tests |
| `chore` | Build process, tooling, dependency updates |
| `docs` | Documentation only changes |
| `style` | Formatting, missing semicolons (no logic change) |
| `perf` | Performance improvement |

**Rules:**
- Subject line: imperative mood, lowercase, no period, max 72 chars
- Scope is optional but encouraged for monorepos: `feat(users): add login endpoint`
- Body explains *why*, not *what*
- Breaking changes: add `!` after type or `BREAKING CHANGE:` footer

**Examples:**
```
feat: add JWT authentication to users module
fix(auth): resolve token expiration not refreshing
refactor(users): extract password hashing to service
test(users): add unit tests for UsersService
chore: update NestJS to v10
```

## Merge Request Description

Use this template for every MR:

```markdown
## Summary
- <bullet: what changed>
- <bullet: what changed>

## Why / Motivation
<explain the reason for this change — problem being solved, requirement, or context>

## How to Test
- [ ] Step 1
- [ ] Step 2
- [ ] Expected result

## Screenshots
<!-- Attach before/after screenshots for UI changes; delete section if not applicable -->
```

**Rules:**
- Summary: bullet points, concise, what changed (not how)
- Motivation: at least 1–2 sentences; no "obvious" descriptions
- Test plan: actionable checklist, not vague ("it works")
- Screenshots: required for any UI change; optional otherwise

## Code Review

### As Author
- Self-review the diff before requesting review
- Link MR to related issue/ticket if applicable
- Annotate non-obvious code decisions in MR comments

### As Reviewer

**Check in this order:**

1. **Correctness** — Does it do what it claims?
2. **Tests** — Are tests present and meaningful? Do edge cases have coverage?
3. **Design** — Is the approach sound? Any simpler alternatives?
4. **Style** — Naming, formatting, unnecessary complexity?
5. **Security** — Any injection risks, exposed secrets, missing validation?

**Comment tone:**
- Prefix suggestions: `nit:` (minor), `question:` (needs clarification), `blocker:` (must fix)
- Ask questions rather than make demands
- Approve with explicit comment when satisfied

**Common blockers:**
- Missing or incorrect tests
- Hardcoded secrets or credentials
- Unhandled error paths at system boundaries
- Breaking API changes without versioning

## Common Mistakes

| Mistake | Correct approach |
|---------|-----------------|
| `feat/AddUserLogin` | `feat/add-user-login` |
| `Fixed login bug` | `fix(auth): resolve login redirect loop` |
| `feat: added, updated, fixed things` | One commit per logical change |
| Empty MR description | Always fill in Summary + Motivation |
| "LGTM" review with no feedback | Leave at least one substantive comment |
