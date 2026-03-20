import {
  CreateDateColumn,
  PrimaryGeneratedColumn,
  UpdateDateColumn,
} from 'typeorm'

export abstract class Base {
  @PrimaryGeneratedColumn()
  id: number

  constructor(id?: number) {
    if (id) this.id = id
  }
}

export type BaseProps<T extends Base> = Omit<T, 'id'> & Partial<Pick<T, 'id'>>

export abstract class CreatedAndUpdated {
  @CreateDateColumn({ name: 'created_at' })
  createdAt: Date

  @UpdateDateColumn({ name: 'updated_at' })
  updatedAt: Date

  constructor(base?: Partial<CreatedAndUpdated>) {
    Object.assign(this, base)
  }
}

export abstract class BaseWithCreatedAndUpdated extends Base {
  @CreateDateColumn({ name: 'created_at' })
  createdAt: Date

  @UpdateDateColumn({ name: 'updated_at' })
  updatedAt: Date

  constructor(base?: Partial<BaseWithCreatedAndUpdated>) {
    super()
    Object.assign(this, base)
  }
}

export type BaseWithCreatedAndUpdatedProps<
  T extends BaseWithCreatedAndUpdated,
> = Omit<T, 'id' | 'createdAt' | 'updatedAt'> &
  Partial<Pick<T, 'id' | 'createdAt' | 'updatedAt'>>
