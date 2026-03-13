import { BaseRepository } from '#repositories/base'

import { OrderItem } from '#entities'

export abstract class AbstractOrderItemRepository extends BaseRepository<OrderItem> {}
