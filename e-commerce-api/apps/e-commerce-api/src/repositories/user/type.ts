import { BaseRepository } from '#repositories/base'

import { User } from '#entities'

export abstract class AbstractUserRepository extends BaseRepository<User> {
  abstract getById(id: string): Promise<User | null>
  abstract getByStripeId(stripeId: string): Promise<User | null>
  abstract getUserRelationsById(id: string): Promise<User | null>
}
