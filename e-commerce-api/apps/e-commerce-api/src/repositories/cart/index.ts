import { Cart } from '#entities'

import { AbstractCartRepository } from './type'

export class CartRepository extends AbstractCartRepository {
  async getCartByUserId(userId: string): Promise<Cart | null> {
    const cart = await this.createQueryBuilder('cart')
      .leftJoinAndSelect('cart.items', 'cartItem')
      .leftJoinAndSelect('cartItem.product', 'product')
      .leftJoinAndSelect('cart.user', 'user')
      .where('user.id = :userId', { userId })
      .getOne()

    return cart
  }
}
