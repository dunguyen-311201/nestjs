import { Cart } from '#entities'

import { CartItemDto } from './cart-item'

export class CartDto {
  id: number
  items: CartItemDto[]
  status: string
  total: number

  constructor(cart: Pick<Cart, 'id' | 'items' | 'status'>) {
    Object.assign(this, cart)
    this.items = cart.items.map((item) => new CartItemDto(item))
    this.total = this.items.reduce(
      (total, item) => total + item.productPrice * item.quantity,
      0,
    )
  }
}
