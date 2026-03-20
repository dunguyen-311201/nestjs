import {
  Column,
  Entity,
  JoinColumn,
  OneToMany,
  OneToOne,
  type Relation,
} from 'typeorm'

import {
  BaseWithCreatedAndUpdated,
  type BaseWithCreatedAndUpdatedProps,
} from './Base'
import { CartItem } from './CartItem'
import { User } from './User'

@Entity({ name: 'carts' })
export class Cart extends BaseWithCreatedAndUpdated {
  @OneToOne(() => User, (user) => user.cart)
  @JoinColumn({ name: 'user_id' })
  user: Relation<User>

  @Column({ type: 'varchar', default: 'active' })
  status: 'active' | 'abandoned' | 'converted'

  @OneToMany(() => CartItem, (cartItem) => cartItem.cart)
  items: Relation<CartItem[]>

  constructor(cart: BaseWithCreatedAndUpdatedProps<Cart>) {
    super()
    if (cart) {
      Object.assign(this, cart)
    }
  }
}
