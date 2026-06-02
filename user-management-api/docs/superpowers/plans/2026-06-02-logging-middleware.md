# Logging Middleware Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add a `LoggingMiddleware` that logs the HTTP method and path of every request to `/users`.

**Architecture:** NestJS middleware runs before guards and route handlers. `LoggingMiddleware` implements `NestMiddleware`, is registered via `UsersModule.configure()` using `MiddlewareConsumer`, and uses the built-in NestJS `Logger` for output. It is tested in isolation by passing mock request/response/next objects directly — no full module bootstrap required.

**Tech Stack:** NestJS (`@nestjs/common`), TypeScript, Jest (`@types/jest`), ts-jest

---

## Current State

> **Note:** `src/users/middleware/logging.middleware.ts` and `UsersModule` registration already exist from a prior commit. The **only missing piece is Task 1 (the spec file)**. Tasks 2–4 are included so you understand the full TDD workflow end-to-end.

---

## File Map

| Action                | Path                                              | Responsibility                   |
| --------------------- | ------------------------------------------------- | -------------------------------- |
| **Create**            | `src/users/middleware/logging.middleware.spec.ts` | Unit tests for the middleware    |
| ~~Create~~ _(exists)_ | `src/users/middleware/logging.middleware.ts`      | The middleware class             |
| ~~Modify~~ _(exists)_ | `src/users/users.module.ts`                       | Register middleware for `/users` |

---

## Task 1: Unit Tests for LoggingMiddleware

**Files:**

- Create: `src/users/middleware/logging.middleware.spec.ts`

> This is the **only task you need to action** — the implementation files already exist.

- [ ] **Step 1.1: Write the failing tests**

Create `src/users/middleware/logging.middleware.spec.ts`:

```typescript
import { Logger } from '@nestjs/common';
import { LoggingMiddleware } from './logging.middleware';

describe('LoggingMiddleware', () => {
  let middleware: LoggingMiddleware;
  let logSpy: jest.SpyInstance;

  beforeEach(() => {
    middleware = new LoggingMiddleware();
    logSpy = jest.spyOn(Logger.prototype, 'log').mockImplementation(() => {});
  });

  afterEach(() => {
    logSpy.mockRestore();
  });

  it('should be defined', () => {
    expect(middleware).toBeDefined();
  });

  it('should call next()', () => {
    const req = { method: 'GET', path: '/users' } as any;
    const res = {} as any;
    const next = jest.fn();

    middleware.use(req, res, next);

    expect(next).toHaveBeenCalledTimes(1);
  });

  it('should log the HTTP method and path', () => {
    const req = { method: 'POST', path: '/users' } as any;
    const res = {} as any;
    const next = jest.fn();

    middleware.use(req, res, next);

    expect(logSpy).toHaveBeenCalledWith('[POST] /users');
  });

  it('should log correctly for DELETE requests', () => {
    const req = { method: 'DELETE', path: '/users/1' } as any;
    const res = {} as any;
    const next = jest.fn();

    middleware.use(req, res, next);

    expect(logSpy).toHaveBeenCalledWith('[DELETE] /users/1');
    expect(next).toHaveBeenCalledTimes(1);
  });
});
```

- [ ] **Step 1.2: Run the tests — expect FAIL (file not found)**

```bash
pnpm test -- --testPathPattern=logging.middleware
```

Expected output:

```
FAIL src/users/middleware/logging.middleware.spec.ts
  ● Test suite failed to run
    Cannot find module './logging.middleware'
```

_(If it passes, the middleware already exists — skip to Step 1.4.)_

- [ ] **Step 1.3: Verify tests fail for the right reason after implementation exists**

Once the implementation file exists (Task 2), re-run:

```bash
pnpm test -- --testPathPattern=logging.middleware
```

Expected: all 4 tests **FAIL** because the class hasn't been wired up yet.

- [ ] **Step 1.4: Run tests — expect PASS**

After completing Task 2:

```bash
pnpm test -- --testPathPattern=logging.middleware
```

Expected output:

```
PASS src/users/middleware/logging.middleware.spec.ts
  LoggingMiddleware
    ✓ should be defined
    ✓ should call next()
    ✓ should log the HTTP method and path
    ✓ should log correctly for DELETE requests
```

- [ ] **Step 1.5: Commit**

```bash
git add src/users/middleware/logging.middleware.spec.ts
git commit -m "test: add unit tests for LoggingMiddleware"
```

---

## Task 2: Implement LoggingMiddleware _(already exists)_

> This task is complete. Included here for reference — the full TDD workflow shows implementation AFTER writing tests.

**Files:**

- Create: `src/users/middleware/logging.middleware.ts`

- [ ] **Step 2.1: Generate the middleware with the NestJS CLI**

```bash
npx nest generate middleware users/middleware/logging --no-spec --flat
```

This scaffolds `src/users/middleware/logging.middleware.ts` with an empty `use()` stub.

- [ ] **Step 2.2: Implement the middleware**

Replace the generated file with:

```typescript
import { Injectable, NestMiddleware, Logger } from '@nestjs/common';
import { Request, Response, NextFunction } from 'express';

@Injectable()
export class LoggingMiddleware implements NestMiddleware {
  private readonly logger = new Logger(LoggingMiddleware.name);

  use(req: Request, res: Response, next: NextFunction): void {
    this.logger.log(`[${req.method}] ${req.path}`);
    next();
  }
}
```

Key decisions:

- `Logger(LoggingMiddleware.name)` tags every log line with `LoggingMiddleware` context, visible in the console.
- `req.path` (not `req.url`) gives the path without query strings.
- `next()` **must** be called — omitting it hangs the request.

- [ ] **Step 2.3: Run the middleware unit tests**

```bash
pnpm test -- --testPathPattern=logging.middleware
```

Expected: all 4 tests **PASS**.

- [ ] **Step 2.4: Commit**

```bash
git add src/users/middleware/logging.middleware.ts
git commit -m "feat: add LoggingMiddleware for request logging"
```

---

## Task 3: Register Middleware in UsersModule _(already exists)_

> This task is complete. Included for reference.

**Files:**

- Modify: `src/users/users.module.ts`

- [ ] **Step 3.1: Update UsersModule to implement NestModule**

```typescript
import {
  MiddlewareConsumer,
  Module,
  NestModule,
  RequestMethod,
} from '@nestjs/common';
import { LoggingMiddleware } from './middleware/logging.middleware';
import { UsersController } from './users.controller';
import { UsersService } from './users.service';

@Module({
  controllers: [UsersController],
  providers: [UsersService],
})
export class UsersModule implements NestModule {
  configure(consumer: MiddlewareConsumer): void {
    consumer
      .apply(LoggingMiddleware)
      .forRoutes({ path: 'users', method: RequestMethod.ALL });
  }
}
```

Why `{ path: 'users', method: RequestMethod.ALL }` instead of `UsersController`:

- `forRoutes(UsersController)` also works and is cleaner, but using the path/method object makes the scope explicit and is easier to follow in a learning context.

- [ ] **Step 3.2: Run all tests to catch regressions**

```bash
pnpm test
```

Expected: all tests **PASS** (no new failures).

- [ ] **Step 3.3: Commit**

```bash
git add src/users/users.module.ts
git commit -m "feat: register LoggingMiddleware in UsersModule for /users routes"
```

---

## Task 4: Manual Verification

- [ ] **Step 4.1: Start the dev server**

```bash
pnpm start:dev
```

- [ ] **Step 4.2: Send a request**

In a second terminal:

```bash
curl -s -o /dev/null -H "authorization: mock-token" http://localhost:3000/users
```

- [ ] **Step 4.3: Observe the log line in the server terminal**

Expected log line (NestJS format):

```
[Nest] LOG [LoggingMiddleware] [GET] /users
```

- [ ] **Step 4.4: Verify middleware order**

The request pipeline for `/users` is:

```
Incoming request
  → LoggingMiddleware  (logs before any guard sees it)
  → MockAuthGuard      (checks authorization header)
  → Route handler
  → HttpExceptionFilter (only on exceptions)
```

Send a request **without** the auth header and confirm the log still appears (middleware runs before guards):

```bash
curl -s -H "authorization: wrong" http://localhost:3000/users
```

Expected: log line `[GET] /users` appears, then a 401 response.

---

## Summary

| Task                                | Status                          |
| ----------------------------------- | ------------------------------- |
| 1. Unit tests for LoggingMiddleware | **TODO — create the spec file** |
| 2. Implement LoggingMiddleware      | ✅ Done (prior commit)          |
| 3. Register in UsersModule          | ✅ Done (prior commit)          |
| 4. Manual verification              | Run any time                    |
