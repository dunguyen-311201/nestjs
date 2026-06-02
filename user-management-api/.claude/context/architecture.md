# Architecture

## Module Tree

```
AppModule (root)
└── UsersModule
    ├── UsersController   — HTTP layer, /users routes
    ├── UsersService      — business logic, in-memory store
    └── LoggingMiddleware — applied to all UsersModule routes
```

`AppModule` also has `AppController` / `AppService` for the root `GET /` health-check route (not part of the users feature).

## Request Pipeline — `/users` routes

```
Incoming request
  → LoggingMiddleware   (logs [METHOD] /path)
  → MockAuthGuard       (validates authorization: mock-token header)
  → Route handler       (UsersController method)
  → HttpExceptionFilter (shapes error responses on exception)
  → Response
```

Middleware is registered in `UsersModule.configure()`. Guard and filter are applied at the controller class level with `@UseGuards` / `@UseFilters`.

## Key Constraints

- **IDs are `Date.now()` timestamps** (milliseconds), not sequential integers. `findOne` uses strict equality (`===`), so the caller must pass the exact timestamp.
- **`MockAuthGuard` requires `authorization: mock-token`** on every request to `/users`. Any other value — including a missing header — throws `UnauthorizedException`.
- **`HttpExceptionFilter` response shape:** `{ timestamp, message }` — not NestJS's default `{ statusCode, message, error }`.

## Adding a New Feature Module

1. Generate: `nest g module <name>` + `nest g controller <name>` + `nest g service <name>`
2. Import the new module in `AppModule`
3. Add middleware in the module's `configure()` if needed
4. Apply guards/filters at controller or route level
