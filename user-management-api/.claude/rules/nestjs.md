# NestJS Conventions

## Module Structure

Each feature module lives in `src/<feature>/` and owns:
- `<feature>.module.ts`
- `<feature>.controller.ts`
- `<feature>.service.ts`
- `<feature>.controller.spec.ts`
- `<feature>.service.spec.ts`
- `filters/`, `guards/`, `middleware/`, `pipes/`, `interceptors/` — sub-folders per enhancer type

## Enhancer Placement

| Enhancer | Scope | How to apply |
|----------|-------|--------------|
| Middleware | Module-level (path-based) | `configure()` in `NestModule` |
| Guard | Controller or route | `@UseGuards()` decorator |
| Filter | Controller or route | `@UseFilters()` decorator |
| Pipe | Route param or global | `@UsePipes()` or `new ValidationPipe()` in `main.ts` |
| Interceptor | Controller or route | `@UseInterceptors()` decorator |

Apply guards and filters at the **controller class** level (not route level) unless a single route needs different behavior.

## Dependency Injection

- Always use **constructor injection** with `private readonly`:
  ```typescript
  constructor(private readonly usersService: UsersService) {}
  ```
- Mark every injectable class with `@Injectable()`
- Register providers in the module's `providers` array; export them if another module needs them

## DTOs

- Place DTOs in `src/<feature>/dto/` as `create-<feature>.dto.ts` / `update-<feature>.dto.ts`
- Use `class-validator` decorators for validation; enable with `ValidationPipe` globally
- Avoid `any` in controller method signatures — define a DTO instead

## Error Handling

- Throw NestJS built-in exceptions (`NotFoundException`, `UnauthorizedException`, etc.) from services
- Custom exception response shapes go in a filter, not inline in controllers
- The current `HttpExceptionFilter` returns `{ timestamp, message }` — maintain this shape for all `/users` errors

## Naming

| Artifact | Pattern | Example |
|----------|---------|---------|
| Module | `<Feature>Module` | `UsersModule` |
| Controller | `<Feature>Controller` | `UsersController` |
| Service | `<Feature>Service` | `UsersService` |
| Guard | `<Description>Guard` | `MockAuthGuard` |
| Filter | `<Description>Filter` | `HttpExceptionFilter` |
| Middleware | `<Description>Middleware` | `LoggingMiddleware` |
| DTO | `<Action><Feature>Dto` | `CreateUserDto` |
