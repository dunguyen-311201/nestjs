import { Cart } from '#entities'

import { BaseRepository } from '../base'

export abstract class AbstractCartRepository extends BaseRepository<Cart> {
  abstract getCartByUserId(userId: string): Promise<Cart | null>
}
