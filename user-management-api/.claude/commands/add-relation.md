---
description: Add a TypeORM relation between two existing entities
argument-hint: "<from-entity> <relation-type> <to-entity>  e.g. 'user hasMany order'"
---

Add a TypeORM relation based on: **$ARGUMENTS**

Parse the argument as `<OwnerEntity> <relationType> <TargetEntity>`.
Supported types: `hasOne`, `hasMany`, `belongsTo`, `manyToMany`.

Steps:
1. Read both entity files to understand their current shape
2. Add the appropriate TypeORM decorator on the owner entity:
   - `hasMany` → `@OneToMany(() => Target, t => t.owner)` + `@ManyToOne` on target
   - `hasOne` → `@OneToOne` + `@JoinColumn` on owner
   - `belongsTo` → `@ManyToOne(() => Target, { nullable: true, eager: false })`
   - `manyToMany` → `@ManyToManyTable` with `@JoinTable` on owner
3. Add the inverse relation decorator on the target entity
4. Update DTOs: add `categoryId`-style FK field to create/update DTOs with `@IsUUID()` + `@IsOptional()`
5. Update the service `findOne`/`findAll` to load the relation via `relations: ['target']` where needed
6. TypeORM `synchronize: true` handles schema — no migration file needed
7. Run `pnpm build` to confirm no TypeScript errors
