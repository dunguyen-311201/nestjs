# Day 2: Scalable Architecture Principles

**Reading:** Chapter 2 (pp. 25–47)

---

## The Blueprint for Growth (pp. 25–32)

### What Is Scalable Architecture? (p. 26)

> "Scalability is the capability of a system to handle a growing amount of work, or its potential to accommodate growth."

**The growing city metaphor:**
- **Option A** — You scramble to build more houses with no plan → messy labyrinth
- **Option B** — You had a well-planned blueprint → small town gracefully grows into a bustling city

Scalable architecture is that well-planned blueprint. It ensures your app scales smoothly instead of turning into a jumbled mess.

---

### The Three Ss of Scalability (p. 27)

| S | Question to ask |
|---|----------------|
| **Speed** | Can your application handle more requests per minute as the user base grows? |
| **Storage** | Can it store more data without choking up? More users = more data |
| **Simplicity** | Can you easily add new features without breaking existing ones? |

---

### Modular Design — A Double-Edged Sword (pp. 27–29)

**Why go modular?**
Modules give your code structure. They logically separate your code base, making it easier to test, debug, and extend. Think of modules as departments in a company — each has its own responsibilities.

```typescript
// AuthModule: only manages authentication logic
@Module({
  imports: [],
  controllers: [AuthController],
  providers: [AuthService],
})
export class AuthModule {}
```

**The risks — when modules go wild:**
Too many modules = chaos. Having a department for every tiny task creates overhead. Excessive modularization can make code harder to follow and debug.

**Decision checklist — to module or not to module:**
- Is the feature **standalone**? Can it function independently?
- Is it **complex**? Does it involve multiple components and providers?
- Will it be **reused**? Is it needed in other parts or future projects?
- Is it a **separate concern**? Does it represent a unique responsibility?

> If you answer "yes" to most → a separate module is beneficial.
> A simple `LoggingService` that just prints to console likely doesn't need its own module.

---

### Statelessness — The Cornerstone of Horizontal Scaling (pp. 29–30)

**The food truck analogy:**
A stateless server is like a food truck that doesn't remember your previous orders. You ask for a burger, you get a burger — end of transaction. This "forgetfulness" makes it easy to replicate the truck across the city (horizontal scaling) without syncing who ordered what.

```typescript
@Controller('stateless')
export class StatelessController {
  @Get()
  statelessEndpoint(): string {
    return 'Hello, anonymous human! Enjoy your stateless interaction.';
  }
}
```

This controller returns the same response to everyone — it holds no memory of who called it. That makes it trivially cloneable across multiple server instances.

**Why statelessness enables horizontal scaling:**
- No session state to synchronize between servers
- Any server can handle any request
- Adding more servers = more capacity, no coordination needed

---

### Database Scalability (p. 30)

As data grows, databases need their own scaling techniques:
- **Sharding** — splitting data across multiple DB instances
- **Replication** — copying data to multiple nodes for read performance and redundancy
- **Partitioning** — dividing a table into smaller, manageable pieces

---

### Event-Driven Architecture (pp. 30–32)

**The cocktail party analogy:**
Instead of walking over to talk to someone directly (direct API call), you announce your news loudly ("Free pizza!") and whoever is interested reacts. You don't manage responses one by one.

In an event-driven architecture:
- One part of the app **emits** an event
- Other parts **listen** and react independently

```typescript
import { EventEmitter2 } from '@nestjs/event-emitter';

@Injectable()
export class EventsService {
  constructor(private eventEmitter: EventEmitter2) {}

  triggerEvent(): void {
    this.eventEmitter.emit('user.created', { /* payload */ });
  }
}
```

**Benefits:** dynamic, responsive, scalable — services are decoupled and react asynchronously.

---

### Load Balancing & Horizontal Scaling (p. 32)

**The concert metaphor:**
A load balancer is like event staff directing thousands of fans to multiple entrances so no single gate becomes a bottleneck.

- **Vertical scaling** — making one server more powerful (limited ceiling)
- **Horizontal scaling** — cloning servers (theoretically unlimited)

A smart load balancer distributes traffic, knows which servers are less crowded, and ensures every user gets a fast response regardless of total load.

---

## Caching Strategies (pp. 33–36)

### What Is Caching? (p. 33)

Caching is the process of storing copies of frequently accessed data in a "cache" so future requests can be served more quickly — saving time and resources.

### Types of Caching (p. 33)

| Type | Analogy | Characteristics |
|------|---------|----------------|
| **In-memory** | Post-it note on your screen | Fast read/write, lost on shutdown |
| **Database** | Pocket notebook | Persistent, slightly slower |
| **Content** | Screenshot of a web page | Serve static snapshots without reloading |

### The ABCs of Caching Strategies (pp. 33–34)

| Strategy | Full Name | How it works |
|----------|-----------|-------------|
| **LRU** | Least Recently Used | When cache is full, evict the item not accessed for the longest time |
| **TTL** | Time To Live | Each cached item has an expiration date — it self-destructs after the set period |
| **Cache invalidation** | — | When source data changes, remove or replace the outdated cached value |

### Caching Pitfalls (p. 34)

| Pitfall | Description |
|---------|-------------|
| **Cache staleness** | Cache is outdated and serves old data |
| **Cache thrashing** | Data keeps getting evicted before it's used — defeats the purpose |
| **Cache complexity** | Over-engineering the cache infrastructure makes it hard to manage |

### Caching in NestJS (pp. 34–36)

```typescript
import { Injectable, CACHE_MANAGER, Inject, CacheStore } from '@nestjs/common';

@Injectable()
export class AppService {
  constructor(
    @Inject(CACHE_MANAGER) private cacheManager: CacheStore,
  ) {}

  async cacheThis(): Promise<string> {
    let value = await this.cacheManager.get('my-key');

    if (value) {
      return `From cache: ${value}`;   // cache hit — served instantly
    }

    value = 'some expensive operation result';
    await this.cacheManager.set('my-key', value, { ttl: 600 }); // cache for 10 min
    return `Processed: ${value}`;      // cache miss — computed and stored
  }
}
```

**How it works:**
1. Try to get the value from cache with `cacheManager.get('my-key')`
2. If found (cache hit) → return immediately, skip expensive work
3. If not found (cache miss) → run the operation, store result with TTL of 600s
4. Next call within 600s hits the cache instead of re-computing

---

## Design Patterns for Scalability (pp. 37–44)

> Design patterns are proven solutions to common problems. In NestJS, following recognized design patterns isn't just a recommendation — it's a cornerstone of the framework's design philosophy.

### The Singleton Pattern — Managing Global State (pp. 36–37)

**Rule:** A class has exactly one instance and provides a global access point to it.

**Why NestJS uses it:** Services often manage database connections, caching, and config data — operations you don't want multiple instances of.

```typescript
@Injectable()
export class MyService {
  // NestJS ensures this is instantiated once and shared across all modules
}
```

`@Injectable()` + NestJS's DI = singleton by default. One instance, consistent state, no conflicts.

---

### The Factory Pattern — Dynamic Object Creation (p. 37)

**Rule:** Create objects without specifying the exact class to be created.

**Why NestJS uses it:** Providers aren't limited to services — they can be objects, strings, numbers, or dynamically created instances.

```typescript
{
  provide: 'MY_FACTORY_TOKEN',
  useFactory: (connection: Connection) => {
    return new MyCustomClass(connection);
  },
  inject: [DbConnectionToken],
}
```

`useFactory` creates the object dynamically based on injected dependencies — the caller never needs to know the construction details.

---

### Dependency Injection — The Loose Coupling Pattern (pp. 37–38)

**DI** is a technique where one object **supplies** the dependencies of another rather than having them constructed internally. It achieves **Inversion of Control (IoC)**.

```typescript
// NestJS injects MyService — the component never creates it directly
constructor(private myService: MyService) {}
```

**Why NestJS swears by DI:**
- Components aren't tightly bound — they're interconnected through a well-defined system
- Systems become modular, testable, and scalable
- Swapping a dependency doesn't require modifying the class

---

### The Decorator Pattern — Extending Functionality (pp. 38–42)

Decorators add new functionality to objects/classes **without altering their structure**. They act as wrappers.

**Why NestJS is built on decorators:**
NestJS uses decorators to gather metadata about classes, functions, and properties at runtime — for setting up HTTP routes, injecting dependencies, establishing WebSocket gateways, and more.

**Benefits of the decorator pattern in NestJS:**

| Benefit | Description |
|---------|-------------|
| **Modularity and clean code** | Abstracts boilerplate — developers focus on business logic |
| **Enhanced functionality with minimal intrusion** | Add role-based access with `@Roles()` without touching the method's logic |
| **Strongly typed system** | `@Body()` + DTOs enforce type constraints at compile time |

#### Without vs With Decorators — Side by Side

**Routing — without decorators:**
```typescript
export class CatsController {
  constructor(private readonly expressApp: Express.Application) {
    this.expressApp.get('/cats', this.findAll.bind(this));
  }
  findAll(req: Request, res: Response) {
    res.send('Returns all cats');
  }
}
```

**Routing — with decorators:**
```typescript
@Controller('cats')
export class CatsController {
  @Get()
  findAll() {
    return 'Returns all cats';
  }
}
```

**Request payload — without decorators:**
```typescript
findCat(req: Request, res: Response) {
  const name = req.query.name;   // manual extraction
  res.send(`Returns cat with name ${name}`);
}
```

**Request payload — with decorators:**
```typescript
@Get('find')
findCat(@Query('name') name: string) {
  return `Returns cat with name ${name}`;
}
```

**DI — without decorators:**
```typescript
export class CatsService {
  private dbConnection: Connection;
  constructor() {
    this.dbConnection = DatabaseConnection.getInstance(); // manual singleton
  }
}
```

**DI — with decorators:**
```typescript
@Injectable()
export class CatsService {
  constructor(
    @Inject('DATABASE_CONNECTION')
    private dbConnection: Connection,
  ) {}
}
```

**Custom decorators:**
```typescript
export const Sanitize = createParamDecorator((data, req) => {
  return sanitize(req.body); // custom sanitization decorator
});
```

> Decorators are not a mere design choice — they are a calculated decision enabling development across web, mobile, and desktop with elegance, functionality, and extensibility.

---

### Asynchronous Programming for Scalability (pp. 43–44)

> "Scalability is to performance what agile is to development."

**What is async programming?**
Allows multiple operations to execute concurrently but not necessarily at the same instant. I/O-bound tasks are offloaded, freeing the main thread to handle other requests.

**Why it matters for scalability:**
- Can't afford idle resources waiting for DB queries or API calls
- Keeps the app responsive even under heavy load
- Apps using async effectively are easier to scale horizontally

**Promises vs async/await:**

```typescript
// With Promises (less readable)
getUserById(id: string) {
  return this.database
    .query(`SELECT * FROM users WHERE id = ${id}`)
    .then(user => user)
    .catch(err => { throw new Error(err); });
}

// With async/await (readable, debuggable)
async getUserById(id: string) {
  try {
    const user = await this.database.query(
      `SELECT * FROM users WHERE id = ${id}`
    );
    return user;
  } catch (err) {
    throw new Error(err);
  }
}
```

**Event loop & non-blocking I/O:**
NestJS is built on Node.js, which uses a single-threaded event loop that handles all async tasks without blocking. Every I/O operation is non-blocking by default.

**Reactive programming with RxJS:**
NestJS integrates with RxJS for composing complex async/callback-based operations — further enabling scalable, reactive services.

---

## Best Practices for Building Scalable Applications (pp. 45–47)

### Code Organization

| Practice | Description |
|----------|-------------|
| **Modular design** | Split into well-defined modules. Keep related functionalities together |
| **Clean code** | Stick to conventions, be consistent in naming, make code self-explanatory |

### Data Storage & Retrieval

| Practice | Description |
|----------|-------------|
| **Database indexing** | Properly indexed databases speed up data retrieval significantly |
| **Caching** | Use caching strategies (LRU/TTL) to serve frequently accessed data, reducing DB load |

### Architecture

| Practice | Description |
|----------|-------------|
| **Microservices** | Decouple parts of the app so individual components can scale independently |
| **Load balancing** | Distribute traffic across multiple servers for high availability and reliability |
| **Middleware & interceptors** | Use as control points for logging, measuring, or modifying requests/responses |

### Quality & Operations

| Practice | Description |
|----------|-------------|
| **CI/CD** | Automate testing and deployment — keep the app always in a deployable state |
| **Automated testing** | Ensures scaling doesn't introduce new bugs |
| **Rate limiting** | Protect APIs from abuse |
| **Validation & sanitization** | Always validate at system boundaries — a secure app is easier to scale |
| **Logging & monitoring** | Tools like Grafana and Prometheus give insights crucial for scaling decisions |
| **KPI tracking** | Monitor response times, error rates, and other key performance indicators |

---

## Summary

| Concept | Core Idea |
|---------|-----------|
| **3 Ss of Scalability** | Speed · Storage · Simplicity |
| **Statelessness** | No server memory = servers are interchangeable = horizontal scaling |
| **Event-driven architecture** | Emit events, let listeners react — decoupled and async |
| **Load balancing** | Distribute traffic across cloned servers |
| **LRU cache** | Evict least recently used item when full |
| **TTL cache** | Items expire after a set time |
| **Cache invalidation** | Replace stale data when source changes |
| **Singleton pattern** | One instance shared globally (`@Injectable()` default) |
| **Factory pattern** | Create objects dynamically (`useFactory`) |
| **DI pattern** | External injector provides dependencies — loose coupling |
| **Decorator pattern** | Add functionality without altering structure (`@Controller`, `@Get`, etc.) |
| **Async / await** | Non-blocking I/O — keeps app responsive under load |
| **Microservices** | Independent components that scale on their own |
