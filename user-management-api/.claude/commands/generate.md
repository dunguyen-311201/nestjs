# NestJS CLI — Generate Commands

All commands use the `nest g` (generate) shorthand. Run from the project root.

## Common Generators

| Artifact | Command | Output |
|----------|---------|--------|
| Module | `nest g module <name>` | `src/<name>/<name>.module.ts` |
| Controller | `nest g controller <name>` | `src/<name>/<name>.controller.ts` + spec |
| Service | `nest g service <name>` | `src/<name>/<name>.service.ts` + spec |
| Guard | `nest g guard <name>` | `src/<name>/<name>.guard.ts` + spec |
| Filter | `nest g filter <name>` | `src/<name>/<name>.filter.ts` + spec |
| Middleware | `nest g middleware <name>` | `src/<name>/<name>.middleware.ts` + spec |
| Pipe | `nest g pipe <name>` | `src/<name>/<name>.pipe.ts` + spec |
| Interceptor | `nest g interceptor <name>` | `src/<name>/<name>.interceptor.ts` + spec |

## Generate Inside a Feature Module

Prefix the path to place files inside an existing module folder:

```bash
nest g guard users/guards/jwt-auth
# → src/users/guards/jwt-auth.guard.ts
```

## Skip Test File

```bash
nest g service users --no-spec
```

## Full Feature Scaffold

Generate module + controller + service in one go:

```bash
nest g module products
nest g controller products
nest g service products
```

NestJS CLI auto-registers the controller and service in the module when generated this way.

## After Generating

- Verify the new artifact is registered in its module (`providers`, `controllers`, or `imports`)
- For middleware: manually implement `NestModule.configure()` — the CLI does not wire this up
- For guards/filters applied globally: register in `main.ts` with `app.useGlobalGuards()` / `app.useGlobalFilters()`
