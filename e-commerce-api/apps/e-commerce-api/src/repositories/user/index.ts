import { User } from '#entities'

import { AbstractUserRepository } from './type'

export class UserRepository extends AbstractUserRepository {
  async getById(id: string): Promise<User | null> {
    return await this.findById(id, {
      relations: { cart: true },
    })
  }

  async getUserRelationsById(id: string): Promise<User | null> {
    const user = await this.findOne({
      where: { id },
      relations: { cart: { items: { product: true } } },
    })

    return user
  }

  async getByStripeId(stripeId: string): Promise<User | null> {
    const user = await this.findOne({ where: { stripeId } })
    return user
  }
}
