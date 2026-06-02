# Testing Commands

## Run Tests

| Task | Command |
|------|---------|
| All unit tests | `pnpm test` |
| Watch mode | `pnpm test:watch` |
| Coverage report | `pnpm test:cov` |
| Single file | `pnpm test -- --testPathPattern=users.service` |
| Single test by name | `pnpm test -- -t "should create a user"` |
| E2E tests | `pnpm test:e2e` |

## File Conventions

- Unit tests: `src/**/*.spec.ts` — co-located with the source file
- E2E tests: `test/*.e2e-spec.ts` — uses `test/jest-e2e.json` config

## Unit Test Structure

Use `@nestjs/testing` to bootstrap isolated modules:

```typescript
import { Test, TestingModule } from '@nestjs/testing';
import { UsersService } from './users.service';

describe('UsersService', () => {
  let service: UsersService;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [UsersService],
    }).compile();

    service = module.get<UsersService>(UsersService);
  });

  it('should create a user', () => {
    const user = service.create({ name: 'Alice' });
    expect(user).toHaveProperty('id');
    expect(user.name).toBe('Alice');
  });
});
```

## Mocking Dependencies

When a service depends on another provider, override it in the test module:

```typescript
const module = await Test.createTestingModule({
  providers: [
    UsersController,
    {
      provide: UsersService,
      useValue: {
        findAll: jest.fn().mockReturnValue([]),
        findOne: jest.fn().mockReturnValue({ id: 1, name: 'Alice' }),
      },
    },
  ],
}).compile();
```

## ID Caveat in Tests

`UsersService` generates IDs via `Date.now()`. When asserting on a specific user by ID, capture the returned ID from `create()` rather than hardcoding a value:

```typescript
const created = service.create({ name: 'Alice' });
const found = service.findOne(created.id);
expect(found).toEqual(created);
```
