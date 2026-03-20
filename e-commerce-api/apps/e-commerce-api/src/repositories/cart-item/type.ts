import { CartItem } from '#entities'

import { BaseRepository } from '../base'

export abstract class AbstractCartItemRepository extends BaseRepository<CartItem> {
  abstract getCartItemByProduct(
    productId: string,
    cartId: number,
  ): Promise<CartItem | null>

  abstract deleteByCartId(cartId: number): Promise<boolean>

  abstract getByCartId(id: number): Promise<CartItem[]>
}
