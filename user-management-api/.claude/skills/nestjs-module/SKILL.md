---
name: nestjs-module
description: Step-by-step workflow for creating a complete, tested NestJS module in this project. Use when asked to add a new resource, domain, or CRUD module.
---

# Creating a NestJS Module

Follow these steps in order. Do not skip steps or combine them.

## Pre-flight

Read `CLAUDE.md` to refresh conventions. Confirm the module name with the user if ambiguous.
Check `src/app.module.ts` — confirm the new module isn't already registered.

## Step 1 — Entity

Create `src/<name>/entities/<name>.entity.ts`.

Required shape:
```ts
@Entity()
export class Name {
  @PrimaryGeneratedColumn('uuid') id!: string;
  // domain fields here
  @CreateDateColumn() createdAt!: Date;
  @UpdateDateColumn() updatedAt!: Date;
}
```

Rules:
- Nullable fields: `@Column({ type: 'text', nullable: true })` typed as `T | null`
- FK relations: `@ManyToOne(() => Other, { nullable: true, eager: false })`
- Do NOT add `@JoinColumn` on ManyToOne — TypeORM infers it

## Step 2 — DTOs

Create in `src/<name>/dto/`:

**create-<name>.dto.ts** — required fields use `@IsNotEmpty()`, optional use `@IsOptional()`
**update-<name>.dto.ts** — every field is `@IsOptional()` (partial of create)

Add `<name>-query.dto.ts` only if the resource needs pagination or filtering.
Add `<name>-response.dto.ts` only if output shape differs from entity (e.g. flattened relations).

## Step 3 — Service

Create `src/<name>/<name>.service.ts`:

```ts
@Injectable()
export class NameService {
  constructor(
    @InjectRepository(Name)
    private readonly repo: Repository<Name>,
  ) {}

  async create(dto: CreateNameDto): Promise<Name> { ... }
  async findAll(): Promise<Name[]> { ... }
  async findOne(id: string): Promise<Name> {
    const item = await this.repo.findOneBy({ id });
    if (!item) throw new NotFoundException('Name not found');
    return item;
  }
  async update(id: string, dto: UpdateNameDto): Promise<Name> { ... }
  async remove(id: string): Promise<Name> { ... }
}
```

## Step 4 — Controller

Create `src/<name>/<name>.controller.ts`:

```ts
@Controller({ path: '<names>', version: '1' })
@UseGuards(MockAuthGuard)
export class NameController {
  constructor(private readonly nameService: NameService) {}
  // POST, GET, GET :id, PUT :id, DELETE :id
}
```

## Step 5 — Module

Create `src/<name>/<name>.module.ts`:

```ts
@Module({
  imports: [TypeOrmModule.forFeature([Name])],
  controllers: [NameController],
  providers: [NameService],
  exports: [NameService],  // only if other modules need it
})
export class NameModule {}
```

## Step 6 — Register

In `src/app.module.ts`:
1. Add `Name` to the TypeORM entity array
2. Add `NameModule` to the `imports` array

## Step 7 — Tests

Create `src/<name>/<name>.service.spec.ts`:
- Mock the repository: `{ provide: getRepositoryToken(Name), useValue: mockRepo }`
- Test: create, findAll, findOne (found), findOne (throws NotFoundException), update, remove

Create `src/<name>/<name>.controller.spec.ts`:
- Mock the service with `jest.fn()` for each method
- Test each endpoint's happy path

## Step 8 — Verify

```bash
pnpm build      # TypeScript must compile clean
pnpm test       # all specs must pass
```

If any step fails, fix before continuing.

## Step 9 — HTTP Samples

Append CRUD examples to `test/api.http` for the new resource.
