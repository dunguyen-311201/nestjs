---
description: Run the test suite and show a clean summary
---

Run the test suite for this NestJS project and report results.

Steps:
1. Run `pnpm test` (unit tests)
2. If any tests fail, show the failing test name, file:line, and the error message
3. If all pass, report the count of test suites and tests that passed
4. If `$ARGUMENTS` is `cov` or `coverage`, run `pnpm test:cov` instead and summarize coverage per file
5. If `$ARGUMENTS` is `e2e`, run `pnpm test:e2e` instead

Do not modify any test files unless I ask you to fix a failing test.
