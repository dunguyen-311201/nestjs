import {
  Column,
  Entity,
  JoinColumn,
  ManyToOne,
  OneToMany,
  type Relation,
} from 'typeorm'

import {
  BaseWithCreatedAndUpdated,
  type BaseWithCreatedAndUpdatedProps,
} from './Base'
import { OrderItem } from './OrderItem'
import { User } from './User'

export type OrderStatus =
  | 'pending'
  | 'processing'
  | 'shipped'
  | 'delivered'
  | 'cancelled'
  | 'paid'

@Entity({ name: 'orders' })
export class Order extends BaseWithCreatedAndUpdated {
  @ManyToOne(() => User, (user) => user.orders)
  @JoinColumn({ name: 'user_id' })
  user?: Relation<User>

  @Column({ type: 'varchar' })
  status: OrderStatus

  @Column({ name: 'total_amount', type: 'decimal' })
  totalAmount: number

  @Column({ name: 'invoice_id', type: 'varchar', nullable: true })
  invoiceId: string

  @OneToMany(() => OrderItem, (orderItem) => orderItem.order, { cascade: true })
  items?: Relation<OrderItem[]>

  @Column({ name: 'payment_secret', type: 'varchar', nullable: true })
  paymentSecret: string

  constructor(order: BaseWithCreatedAndUpdatedProps<Order>) {
    super()
    if (order) {
      Object.assign(this, order)
    }
  }
}
