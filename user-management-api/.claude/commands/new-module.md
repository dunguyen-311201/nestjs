---
description: Scaffold a complete NestJS module following this project's patterns
argument-hint: "<module-name> (e.g. orders)"
---

Scaffold a complete NestJS module named **$ARGUMENTS** following the project's established patterns.

Read `CLAUDE.md` first to confirm conventions, then create all files in the correct order:

1. **Entity** — `src/$ARGUMENTS/entities/$ARGUMENTS.entity.ts`
   - UUID primary key, createdAt, updatedAt
   - Ask me what fields/relations are needed before creating

2. **DTOs** — `src/$ARGUMENTS/dto/`
   - `create-$ARGUMENTS.dto.ts` — required fields with validators
   - `update-$ARGUMENTS.dto.ts` — same fields, all `@IsOptional()`
   - Add query or response DTO only if the entity needs pagination or output shaping

3. **Service** — `src/$ARGUMENTS/$ARGUMENTS.service.ts`
   - Inject `@InjectRepository($Entity)`
   - Implement: `create`, `findAll`, `findOne`, `update`, `remove`
   - Throw `NotFoundException('$Entity not found')` in `findOne`

4. **Controller** — `src/$ARGUMENTS/$ARGUMENTS.controller.ts`
   - `@Controller({ path: '$ARGUMENTS', version: '1' })`
   - `@UseGuards(MockAuthGuard)` at class level
   - POST, GET, GET :id, PUT :id, DELETE :id

5. **Module** — `src/$ARGUMENTS/$ARGUMENTS.module.ts`
   - `TypeOrmModule.forFeature([$Entity])`
   - Export the service if other modules may need it

6. **Register in AppModule** — add to `imports` array and to the TypeORM entity list in `app.module.ts`

7. **Tests** — `src/$ARGUMENTS/$ARGUMENTS.service.spec.ts` and `$ARGUMENTS.controller.spec.ts`
   - Mock the repository with `getRepositoryToken`
   - Cover create, findAll, findOne (found + not-found), update, remove

After scaffolding, run `pnpm test` to confirm the new specs pass.
