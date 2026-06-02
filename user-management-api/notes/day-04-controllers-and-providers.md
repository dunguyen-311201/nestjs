# Day 4: Controllers & Providers

**Reading:** Chapter 3 (pp. 62–67) · Chapter 4 (pp. 87–103, 118–124)

---

## Chapter 3 — Handling Requests and Logic (pp. 62–67)

### Controllers — The Door Attendants (pp. 62–64)

Controllers are the **front door** of every NestJS application. Like door attendants in a grand mansion, they greet every incoming request and direct it to the right service.

**Responsibilities:**
- Take incoming HTTP requests
- Route them to the appropriate handler method
- Return responses to the client

**Create with CLI:**
```bash
$ nest generate controller <controller-name>
# shorthand
$ nest g co <controller-name>
```

**Manual structure:**
```typescript
import { Controller, Get } from '@nestjs/common';

@Controller('<route-name>')
export class MyController {
  @Get()
  findAll(): string {
    return 'This is a sample response!';
  }
}
```

> After creating, always **import and register** the controller in its module.

**HTTP method decorators:**

| Decorator | Purpose |
|-----------|---------|
| `@Get()` | Handle GET requests |
| `@Post()` | Handle POST requests |
| `@Put()` | Handle PUT (update) requests |
| `@Delete()` | Handle DELETE requests |

You can also pass a sub-route string: `@Get('details')` → handles `GET /route/details`.

**Dynamic routes with `@Param`:**
```typescript
@Get('users/:userId')
fetchUserDetails(@Param('userId') userId: string): string {
  return `Details for user with ID: ${userId}`;
}
```

> Each handler method should have a **single, clear responsibility**. This ensures scalability and maintainability.

---

### Providers — The Skilled Chefs (pp. 64–67)

If controllers are the door attendants, providers are the **skilled chefs** working behind the scenes — encapsulating all core business logic.

**What is a provider?**
A class that acts as a source of something — data, logic, or any action integral to the application. Decorated with `@Injectable()`.

**Create with CLI:**
```bash
$ nest generate service <service-name>
# shorthand
$ nest g s <service-name>
```

**Manual structure:**
```typescript
import { Injectable } from '@nestjs/common';

@Injectable()
export class MyService {
  performTask(): string {
    return 'Executing the core task!';
  }
}
```

> After creating, always **import and register** the service in its module.

---

### Dependency Injection — The Magic Behind Providers (pp. 65–67)

**Dependency Injection (DI)** is a technique where one object supplies the dependencies of another rather than having them constructed internally. It is pivotal to achieving **Inversion of Control (IoC)** and promotes **loose coupling**.

**Without DI (manual, cumbersome):**
```typescript
export class CatsService {
  private dbConnection: Connection;
  constructor() {
    this.dbConnection = DatabaseConnection.getInstance(); // singleton manually
  }
}
```

**With DI (NestJS way — sleek and painless):**
```typescript
@Injectable()
export class UserService {
  constructor(
    private readonly databaseService: DatabaseService,
  ) {}

  fetchUserData(): string {
    return this.databaseService.getData('user');
  }
}
```

NestJS injects `DatabaseService` automatically — `UserService` never creates it directly.

> **Single Responsibility Principle:** Each provider should manage a singular, distinct functionality.

**Custom providers — beyond classes:**
Providers aren't limited to services. They can be values, factories, objects, or strings. NestJS uses the **factory pattern** for this flexibility:
```typescript
{
  provide: 'MY_FACTORY_TOKEN',
  useFactory: (connection: Connection) => {
    return new MyCustomClass(connection);
  },
  inject: [DbConnectionToken],
}
```

---

## Chapter 4 — Controller Essentials & Advanced Practices (pp. 87–103)

### Basic Routing (pp. 88–89)

```typescript
@Controller('users')
export class UsersController {
  @Get()
  findAll() {
    return 'This action returns all users';
  }

  @Get('details')
  findDetails() { return 'Details about users'; }

  @Get('images')
  findImages() { return 'Images of various users'; }
}
```

- `@Controller('users')` → all routes prefixed with `/users`
- `@Get()` alone → handles `GET /users`
- `@Get('details')` → handles `GET /users/details`

> A controller **must always belong to a module**. Without a module, its routes are never registered.

---

### Parameterized Routes — `@Param` (pp. 89–90)

Used to extract dynamic segments from the URL.

```typescript
@Get(':id')
findOne(@Param('id') id: string) {
  return `This action returns a user with ID ${id}`;
}
```

- Route defined as `@Get(':id')` — expects `id` in the URL
- `@Param('id')` binds the URL segment to the method argument
- `GET /users/123` → `id = '123'`

**Multiple parameters:**
```typescript
@Get(':id/:sex/:minAge')
filterUsers(
  @Param('id') id: string,
  @Param('sex') sex: string,
  @Param('minAge') minAge: number,
  @Query('salary') salary?: number,
) {
  return `Fetching users with ID: ${id}, Sex: ${sex}, Min Age: ${minAge}, Salary: ${salary || 'Not Specified'}`;
}
```

URL: `/users/123/male/2?salary=10000` → `id=123`, `sex=male`, `minAge=2`, `salary=10000`

---

### Query Parameters — `@Query` (pp. 90–91)

`@Query()` extracts query string parameters (`?key=value`).

```typescript
@Get('find')
findCat(@Query('name') name: string) {
  return `Returns cat with name ${name}`;
}
```

- Optional params default to `undefined` if not provided
- Use `?` in the TypeScript type for optional: `salary?: number`

---

### Scaling Controllers (pp. 92–93)

Keep controllers **lean** — they route, they don't compute. Strategies:

| Strategy | How |
|----------|-----|
| **Separate concerns (SRP)** | Split `UsersController` and `OrdersController` if managing both |
| **Use modules** | Group related controllers/services into a `UsersModule` |
| **Use middleware & interceptors** | Handle logging, auth, transformation outside the controller |
| **Delegate to service classes** | Never put DB queries or business logic directly in the controller |

```typescript
@Controller('users')
export class UsersController {
  constructor(private usersService: UsersService) {}

  @Get(':id')
  findUserById(@Param('id') id: string) {
    return this.usersService.findById(id); // logic lives in service
  }
}
```

---

### The Request Object — `@Req()` (pp. 93–96)

The `Request` object gives access to the full incoming HTTP request.

```typescript
import { Controller, Get, Req } from '@nestjs/common';
import { Request } from 'express';

@Controller('info')
export class InfoController {
  @Get()
  extractReqInfo(@Req() request: Request) {
    return {
      method: request.method,
      url: request.url,
      headers: request.headers,
    };
  }
}
```

Useful for: reading headers (auth tokens, content-type), extracting client IP, annotating requests with custom metadata.

---

### DTOs and Validation Pipelines (pp. 96–100)

**Data Transfer Objects (DTOs)** define the shape and type constraints of incoming data.

**Nested DTOs:**
```typescript
class AddressDTO {
  @IsString() @IsNotEmpty() street: string;
  @IsNumber() houseNumber: number;
}

export class UserDTO {
  @IsString() @IsNotEmpty() name: string;
  @ValidateNested() address: AddressDTO;
}
```

**Conditional validation groups:**
```typescript
export class UpdateUserDTO {
  @IsString()
  @IsNotEmpty({ groups: ['create'] }) // required only on create
  name: string;

  @IsString() @IsOptional()
  bio?: string;
}
```

**Custom validation decorator:**
```typescript
export function IsPalindrome(validationOptions?: ValidationOptions) {
  return registerDecorator({
    name: 'IsPalindrome',
    validator: {
      validate(value: any) {
        return typeof value === 'string' &&
          value === value.split('').reverse().join('');
      }
    },
    options: validationOptions,
  });
}
```

**Data transformation with `class-transformer`:**
```typescript
export class UserDTO {
  @IsString() name: string;

  @Transform(value => value.toUpperCase())
  favoriteColor: string; // always stored uppercase
}
```

---

### Interceptors (pp. 101–103)

Interceptors execute **before and after** a route handler. Used for logging, transformation, or performance measurement.

```typescript
@Injectable()
export class UppercaseInterceptor implements NestInterceptor {
  intercept(context: ExecutionContext, next: CallHandler): Observable<any> {
    return next.handle().pipe(
      map(data => (typeof data === 'string' ? data.toUpperCase() : data)),
    );
  }
}
```

**Response wrapping interceptor:**
```typescript
@Injectable()
export class ResponseInterceptor implements NestInterceptor {
  intercept(context: ExecutionContext, next: CallHandler): Observable<any> {
    return next.handle().pipe(
      map(data => ({ status: 'success', data })),
    );
  }
}
```

Every response becomes `{ status: 'success', data: <original> }`.

---

### Middleware (pp. 103)

Middleware runs **before** route handlers. It has access to `Request`, `Response`, and `next()`.

```typescript
@Injectable()
export class LoggingMiddleware implements NestMiddleware {
  use(req: Request, res: Response, next: NextFunction) {
    console.log(`[${new Date().toISOString()}] Request made to: ${req.path}`);
    next();
  }
}
```

Middleware tasks: logging, authentication, request modification, calling `next()`.

---

## Chapter 4 — Providers in Depth (pp. 118–124)

### What Constitutes a Provider? (pp. 118–119)

Providers are the **cornerstone** of NestJS's DI system. Any class annotated with `@Injectable()` that can be injected is a provider.

**4 types of providers:**

| Type | Description |
|------|-------------|
| **Services** | Classes handling business logic and data retrieval |
| **Factories** | Functions that return a provider instance dynamically |
| **Values** | Hardcoded values that can be injected |
| **Classes** | A class itself used as a provider |

---

### How DI Works (pp. 119–120)

NestJS DI provides components with their dependencies rather than creating them internally.

```typescript
@Controller('cats')
export class CatsController {
  constructor(private catsService: CatsService) {}

  findAll() {
    return this.catsService.findAll();
  }
}
```

NestJS's runtime creates an instance of `CatsService` and passes it to `CatsController` automatically.

---

### Provider Scope & Lifetime (pp. 120–121)

| Scope | Behaviour |
|-------|-----------|
| **Singleton** (default) | One instance shared across the entire application |
| **Request** | New instance per incoming request |
| **Transient** | New instance every time it is injected |

```typescript
// Request scoped
@Injectable({ scope: Scope.REQUEST })
export class RequestScopedService {}

// Transient scoped
@Injectable({ scope: Scope.TRANSIENT })
export class TransientService {}
```

---

### Custom Providers (pp. 121–122)

Defined in the module's `providers` array using object syntax:

| Key | Use case |
|-----|---------|
| `useFactory` | Create provider dynamically with logic or async operations |
| `useClass` | Provide a class to be instantiated |
| `useValue` | Inject a constant value or config object |
| `useExisting` | Alias an existing provider |

```typescript
// useFactory — async connection
{ provide: 'ASYNC_CONNECTION', useFactory: async () => await createConnection() }

// useClass
{ provide: 'Connection', useClass: DatabaseConnection }

// useValue — config injection
{ provide: 'CONFIG', useValue: { host: process.env.DB_HOST } }

// useExisting — alias
{ provide: 'AliasConnection', useExisting: DatabaseConnection }
```

---

### Exporting Providers (pp. 123)

By default, providers are **private** to their module. To share across modules, export them:

```typescript
@Module({
  providers: [CatsService],
  exports: [CatsService], // now accessible to any module that imports CatsModule
})
export class CatsModule {}
```

---

### Enhancers as Providers (pp. 123–124)

Interceptors, filters, guards, and pipes are treated as providers in NestJS. They extend framework behaviour rather than provide data.

```typescript
@Injectable()
export class LoggingInterceptor implements NestInterceptor {
  intercept(context: ExecutionContext, next: CallHandler): Observable<any> {
    console.log('Logging...');
    return next.handle();
  }
}
```

Registered exactly like services and can use constructor DI.

---

## Summary

| Concept | Mental Model | Key Decorator |
|---------|-------------|--------------|
| Controller | Door attendant / Traffic manager | `@Controller()` |
| Provider / Service | Skilled chef / Business logic owner | `@Injectable()` |
| DI | NestJS wires dependencies automatically | Constructor injection |
| `@Param` | Extract dynamic URL segments | `@Param('key')` |
| `@Query` | Extract query string values | `@Query('key')` |
| `@Req` | Access full request object | `@Req()` |
| DTO | Data shape + validation contract | `class-validator` decorators |
| Interceptor | Wrap/transform request & response | `NestInterceptor` |
| Middleware | Pre-handler side effects | `NestMiddleware` |
| Provider scope | Singleton (default) · Request · Transient | `{ scope: Scope.X }` |
| Custom provider | useFactory · useClass · useValue · useExisting | Module `providers` array |
