import { Customer, CustomerCreateParams, USER_ROLES } from '#types'

import { User } from '#entities'

export interface IUserService {
  addRoleForUser(userId: string, role: USER_ROLES): Promise<User>
  getById(id: string): Promise<User | null>
  save(user: User): Promise<User>
  createStripeCustomer(params: CustomerCreateParams): Promise<Customer>
}
