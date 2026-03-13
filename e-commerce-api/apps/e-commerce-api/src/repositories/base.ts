import {
  FindManyOptions,
  FindOneOptions,
  FindOptionsRelations,
  FindOptionsWhere,
  ObjectLiteral,
  Repository,
} from 'typeorm'

import { NotFoundError, Pagination } from '#types'

/**
 * Base repository class that extends TypeORM Repository with common operations
 * All repositories should extend this class or an abstract repository that extends this
 */
export class BaseRepository<
  T extends ObjectLiteral = ObjectLiteral,
> extends Repository<T> {
  constructor({ target, manager }: Repository<T>) {
    super(target, manager)
  }

  /**
   * Find entity by ID or throw NotFoundError
   * @param id - Entity ID (string or number)
   * @param options - Optional find options (relations, select, etc.)
   * @returns Entity if found
   * @throws NotFoundError if entity not found
   */
  async findByIdOrFail(
    id: string | number,
    options?: {
      relations?: FindOptionsRelations<T>
      select?: (keyof T)[]
    },
  ): Promise<T> {
    const where = { id } as unknown as FindOptionsWhere<T>
    const findOptions: FindOneOptions<T> = {
      where,
      ...(options?.relations && { relations: options.relations }),
      ...(options?.select && { select: options.select as (keyof T)[] }),
    }

    const entity = await this.findOne(findOptions)

    if (!entity) {
      const entityName =
        this.target instanceof Function ? this.target.name : 'Entity'
      throw new NotFoundError(`${entityName} with ID ${id} not found`)
    }

    return entity
  }

  /**
   * Find entity by ID (returns null if not found)
   * @param id - Entity ID (string or number)
   * @param options - Optional find options (relations, select, etc.)
   * @returns Entity or null
   */
  async findById(
    id: string | number,
    options?: {
      relations?: FindOptionsRelations<T>
      select?: (keyof T)[]
    },
  ): Promise<T | null> {
    const where = { id } as unknown as FindOptionsWhere<T>
    const findOptions: FindOneOptions<T> = {
      where,
      ...(options?.relations && { relations: options.relations }),
      ...(options?.select && { select: options.select as (keyof T)[] }),
    }
    return await this.findOne(findOptions)
  }

  /**
   * Check if entity exists by ID
   * @param id - Entity ID (string or number)
   * @returns true if exists, false otherwise
   */
  async existsById(id: string | number): Promise<boolean> {
    const where = { id } as unknown as FindOptionsWhere<T>
    const count = await this.count({ where })
    return count > 0
  }

  /**
   * Soft delete entity (if entity has 'deleted' field) or hard delete
   * @param id - Entity ID (string or number)
   * @throws NotFoundError if entity not found
   */
  async softDeleteById(id: string | number): Promise<void> {
    const entity = await this.findByIdOrFail(id)

    // Check if entity has deleted field
    if ('deleted' in entity) {
      await this.update(id, { deleted: true } as unknown as Partial<T>)
    } else {
      // Fall back to hard delete if no deleted field
      await this.delete(id)
    }
  }

  /**
   * Find entities with pagination
   * @param options - Pagination and find options
   * @returns Object with data array and pagination metadata
   */
  async findWithPagination(options: {
    page: number
    pageSize: number
    where?: FindOptionsWhere<T> | FindOptionsWhere<T>[]
    relations?: FindOptionsRelations<T>
    order?: { [P in keyof T]?: 'ASC' | 'DESC' }
  }): Promise<{
    data: T[]
    meta: {
      pagination: Pagination
    }
  }> {
    const { page, pageSize, where, relations, order } = options
    const skip = (page - 1) * pageSize

    const findOptions: FindManyOptions<T> = {
      where,
      ...(relations && { relations }),
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      ...(order && { order: order as any }),
      skip,
      take: pageSize,
    }

    const [data, total] = await this.findAndCount(findOptions)

    return {
      data,
      meta: {
        pagination: {
          totalItems: total,
          itemCount: data.length,
          itemsPerPage: pageSize,
          totalPages: Math.ceil(total / pageSize),
          currentPage: page,
        },
      },
    }
  }

  /**
   * Find entities with pagination (returns tuple format for backward compatibility)
   * @param options - Pagination and find options
   * @returns Tuple [totalCount, entities]
   */
  async findWithPaginationTuple(options: {
    page: number
    pageSize: number
    where?: FindOptionsWhere<T> | FindOptionsWhere<T>[]
    relations?: FindOptionsRelations<T>
    order?: { [P in keyof T]?: 'ASC' | 'DESC' }
  }): Promise<[number, T[]]> {
    const { page, pageSize, where, relations, order } = options
    const skip = (page - 1) * pageSize

    const findOptions: FindManyOptions<T> = {
      where,
      ...(relations && { relations }),
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      ...(order && { order: order as any }),
      skip,
      take: pageSize,
    }

    const [data, total] = await this.findAndCount(findOptions)
    return [total, data]
  }

  /**
   * Find all entities with optional filtering
   * @param options - Find options
   * @returns Array of entities
   */
  async findAll(options?: {
    where?: FindOptionsWhere<T> | FindOptionsWhere<T>[]
    relations?: FindOptionsRelations<T>
    order?: { [P in keyof T]?: 'ASC' | 'DESC' }
  }): Promise<T[]> {
    const findOptions: FindManyOptions<T> = {
      ...(options?.where && { where: options.where }),
      ...(options?.relations && { relations: options.relations }),
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      ...(options?.order && { order: options.order as any }),
    }
    return await this.find(findOptions)
  }

  /**
   * Update entity by ID or throw NotFoundError
   * @param id - Entity ID (string or number)
   * @param updates - Partial entity data to update
   * @returns Updated entity
   * @throws NotFoundError if entity not found
   */
  async updateById(id: string | number, updates: Partial<T>): Promise<T> {
    // Check if entity exists
    await this.findByIdOrFail(id)

    // Update entity
    await this.update(id, updates)

    // Return updated entity
    return await this.findByIdOrFail(id)
  }

  /**
   * Create or update entity (upsert)
   * @param entity - Entity data
   * @param where - Where clause to find existing entity
   * @returns Created or updated entity
   */
  async createOrUpdate(
    entity: Partial<T>,
    where: FindOptionsWhere<T>,
  ): Promise<T> {
    const existing = await this.findOne({ where })

    if (existing) {
      await this.update(existing.id, entity)
      return await this.findByIdOrFail(existing.id)
    }

    return await this.save(entity as T)
  }

  /**
   * Count entities with optional where clause
   * @param where - Optional where clause
   * @returns Count of entities
   */
  async countBy(
    where?: FindOptionsWhere<T> | FindOptionsWhere<T>[],
  ): Promise<number> {
    return await this.count({ where })
  }
}
