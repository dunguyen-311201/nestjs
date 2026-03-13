import { FastifyBaseLogger } from 'fastify'

import env from '#env'

import type { TCartRepository, TUserRepository } from '#repositories'

import {
  EmailProvider,
  IIdentityProvider,
  MailTemplate,
  PaymentGateway,
} from '#types'

import { User } from '#entities'

import { IAuthService } from './type'

export class AuthService implements IAuthService {
  constructor(
    private userRepository: TUserRepository,
    private cartRepository: TCartRepository,
    private paymentGatewayProvider: PaymentGateway,
    private mailProvider: EmailProvider,
    private logger: FastifyBaseLogger,
    private identityProvider: IIdentityProvider,
  ) {}

  async register(body: User) {
    const {
      email,
      name,
      avatar,
      firstName,
      lastName,
      username,
      phone,
      age,
      role,
      id,
    } = body

    this.logger.info({ email, name }, 'Registering new user')

    const customer = await this.paymentGatewayProvider.findOrCreateCustomer({
      email,
      name,
    })
    const user = await this.userRepository.save({
      avatar,
      firstName,
      lastName,
      username,
      phone,
      stripeId: customer.id,
      age,
      role,
      id,
      email,
    })
    await this.cartRepository.save({
      user,
      status: 'active',
      items: [],
    })

    this.logger.debug({ userId: user.id }, 'Cart created for user')

    const loginPath = `${env.client.baseUrl}${env.client.loginPath}`

    await this.mailProvider.send({
      from: env.mail.fromEmail,
      to: email,
      subject: `Welcome to ${env.app.name} — Account Created!`,
      templateName: MailTemplate.REGISTER,
      dynamicTemplateData: {
        name,
        email,
        app_name: env.app.name,
        logo_url: env.app.logoUrl,
        login_url: loginPath,
        support_email: env.mail.supportEmail,
        year: new Date().getFullYear(),
      },
    })

    this.logger.info(
      { userId: user.id, email },
      'User registered successfully, confirmation email sent',
    )
    return user
  }

  async login(
    identifier: string,
    password: string,
  ): Promise<{ user: User; jwt: string }> {
    this.logger.info({ identifier }, 'Login attempt')
    const { jwt, userId } = await this.identityProvider.login(
      identifier,
      password,
    )
    const user = await this.userRepository.getById(userId)
    return { jwt, user: user! }
  }
}
