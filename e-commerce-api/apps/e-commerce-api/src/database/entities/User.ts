import {
  Column,
  CreateDateColumn,
  Entity,
  OneToMany,
  OneToOne,
  PrimaryColumn,
  type Relation,
  UpdateDateColumn,
} from 'typeorm'

import { Cart } from './Cart'
import { Order } from './Order'

import { USER_ROLES } from '#types'

@Entity({ name: 'users' })
export class User {
  @PrimaryColumn({ type: 'varchar' })
  id: string

  @Column({ unique: true, type: 'varchar', nullable: true })
  username: string

  @Column({ name: 'first_name', type: 'varchar' })
  firstName: string

  @Column({ name: 'last_name', nullable: true, type: 'varchar' })
  lastName: string

  @Column({ nullable: true, type: 'int' })
  age?: number

  @Column({ unique: true, type: 'varchar' })
  email: string

  @Column({ unique: true, type: 'varchar', nullable: true })
  phone?: string

  @Column({ nullable: true, type: 'varchar' })
  avatar: string

  @Column({ type: 'varchar', nullable: true })
  password?: string

  @Column({
    type: 'varchar',
    unique: true,
    nullable: true,
    name: 'stripe_id',
  })
  stripeId?: string

  @OneToOne(() => Cart, (cart) => cart.user)
  cart?: Relation<Cart>

  @OneToMany(() => Order, (order) => order.user)
  orders?: Relation<Order[]>

  @CreateDateColumn({ name: 'created_at' })
  createdAt: Date

  @Column({ type: 'varchar', nullable: true })
  role: USER_ROLES

  @UpdateDateColumn({ name: 'updated_at' })
  updatedAt: Date

  get name() {
    return [this.firstName, this.lastName].filter(Boolean).join(' ')
  }

  constructor(user: User) {
    if (user) {
      Object.assign(this, user)
      this.role = user.role || USER_ROLES.USER
    }
  }
}
