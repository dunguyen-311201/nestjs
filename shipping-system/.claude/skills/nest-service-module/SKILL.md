---
name: nest-service-module
description: Use when adding a new feature module to any app under apps/ (entities, DTOs, controller, service, ports/adapters, tests) so it follows the shipping-system Ports & Adapters DI convention (docs/lld/00-conventions.md), TypeORM/NATS boundaries, the BR error envelope, and TDD. Trigger on "new module", "scaffold module", "add a <domain> module", "add an entity/repository".
---

# Skill: Scaffold a NestJS feature module (Ports & Adapters)

## When to use
Adding a new feature module under `apps/<service>/src/<name>/` during Phase 5+
implementation — e.g. `apps/order/src/order/`, `apps/hub/src/hub/`.

## Required shape
```
<name>/
  <name>.module.ts        # wires controller + service + TypeORM entities + port bindings
  <name>.controller.ts    # thin — maps DTOs to service calls, no business logic
  <name>.service.ts       # business rules; depends only on ports (I<X>), never TypeORM/nats directly
  entities/<x>.entity.ts  # TypeORM entity, schema-scoped per docs/lld/<service>-service.md
  dto/<x>.dto.ts          # class-validator, includes Idempotency-Key where the LLD requires it
  ports/<x>.repository.port.ts     # abstract class, one per aggregate this module owns
  adapters/<x>.repository.ts       # TypeORM-backed implementation of the port
  <name>.service.spec.ts  # TDD: written first — happy path + each BR guard failure
```

Add `ports/event-publisher.port.ts` + a NATS adapter **only if the app doesn't
already have one** — most apps need exactly one `IEventPublisher`, reused by
every module in that app, not one per module.

## Naming — `I` prefix on DI ports only
`abstract class I<Name>` marks an injectable/swappable port bound via
`providers`. `libs/contracts`'s data-shape interfaces (`BaseEventV1`,
`OrderCreatedEventV1`) describe wire payloads, not injectable contracts, and
stay unprefixed — the `I` marks that distinction, it isn't a blanket
"interfaces get `I`" rule.

## Rules (must hold — see docs/lld/00-conventions.md)
1. **TDD**: write `<name>.service.spec.ts` first, confirm it fails (red), then
   implement the minimum to pass (green), then refactor.
2. Service depends on `I<X>Repository` / `IEventPublisher` (abstract classes),
   never on `Repository<Entity>`, `DataSource`, or the raw `nats` client
   directly. Those imports live only inside `adapters/`.
3. Business-rule guard failures throw `BusinessRuleException` (`422` with
   `{ rule: 'BR-XX', message }`), not a generic error or a Result type.
4. Money = integer cents, weight = integer grams, timestamps = UTC.
5. Cross-service references are plain UUID columns — never a DB `FOREIGN KEY`
   across service schemas (same-service relations may use a real FK).
6. Publish NATS events (via `IEventPublisher`, using `@app/contracts` types
   and `NATS_SUBJECTS` from `@app/contracts`) only after the local write
   commits.
7. Every `POST` that mutates state validates `Idempotency-Key` per the
   convention doc — don't reinvent the dedup key format.
8. Don't add a port for something with no second implementation and no test
   need for a fake — e.g. Pricing invoked in-process by Order stays a plain
   injected class, not a port.

## Templates

### port
```ts
// ports/<x>.repository.port.ts
export abstract class I<X>Repository {
  abstract findById(id: string): Promise<<X> | null>;
  abstract save(entity: <X>): Promise<void>;
}
```

### adapter
```ts
// adapters/<x>.repository.ts
import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { I<X>Repository } from '../ports/<x>.repository.port';
import { <X> } from '../entities/<x>.entity';

@Injectable()
export class TypeOrm<X>Repository implements I<X>Repository {
  constructor(@InjectRepository(<X>) private readonly repo: Repository<X>) {}

  findById(id: string) {
    return this.repo.findOneBy({ id });
  }

  async save(entity: <X>) {
    await this.repo.save(entity);
  }
}
```

### service
```ts
// <name>.service.ts
@Injectable()
export class <Name>Service {
  constructor(
    private readonly repo: I<X>Repository,
    private readonly events: IEventPublisher,
  ) {}

  async create(input: Create<X>Input): Promise<X> {
    // guard: throw new BusinessRuleException('BR-XX', '...') on violation
    // happy path: build entity, repo.save, then events.publish(...) after commit
  }
}
```

### module
```ts
// <name>.module.ts
@Module({
  imports: [TypeOrmModule.forFeature([<X>])],
  controllers: [<Name>Controller],
  providers: [
    <Name>Service,
    { provide: I<X>Repository, useClass: TypeOrm<X>Repository },
  ],
})
export class <Name>Module {}
```

## After scaffolding
- Run `pnpm build && pnpm lint && pnpm test`.
- Update `docs/PROGRESS.md` and `TASKS.md` (or run `/wrap-task`).
