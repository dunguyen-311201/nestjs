import { FastifyBaseLogger } from 'fastify'

import type { TUserRepository } from '#repositories'

import {
  Customer,
  CustomerCreateParams,
  PaymentGateway,
  USER_ROLES,
} from '#types'

import { User } from '#entities'

import { IUserService } from './type'

export class UserService implements IUserService {
  constructor(
    private userRepository: TUserRepository,
    private paymentGateway: PaymentGateway,
    private logger: FastifyBaseLogger,
  ) {}

  async addRoleForUser(userId: string, role: USER_ROLES): Promise<User> {
    this.logger.info({ userId, role }, 'Adding role to user')
    const user = await this.userRepository.getById(userId)

    if (!user) {
      this.logger.warn({ userId, role }, 'User not found for role assignment')
      throw new Error('User not found')
    }
    const updatedUser = await this.userRepository.save({ ...user, role })
    this.logger.info({ userId, role }, 'Role added to user successfully')
    return updatedUser
  }

  async getById(id: string): Promise<User | null> {
    this.logger.debug({ userId: id }, 'Fetching user by ID')
    return await this.userRepository.findOneBy({ id })
  }

  save(user: User): Promise<User> {
    this.logger.info({ userId: user.id, email: user.email }, 'Saving user')
    return this.userRepository.save(user)
  }

  async createStripeCustomer(params: CustomerCreateParams): Promise<Customer> {
    this.logger.info({ email: params.email }, 'Creating Stripe customer')
    const customer = await this.paymentGateway.createCustomer(params)
    this.logger.info(
      { email: params.email, customerId: customer.id },
      'Stripe customer created successfully',
    )
    return customer
  }
}
