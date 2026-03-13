import { ClerkClient } from '@clerk/fastify'
import { FastifyBaseLogger } from 'fastify'

import env from '#env'

import { IIdentityProvider } from '#types'

export class ClerkIdentityProvider implements IIdentityProvider {
  constructor(
    private client: ClerkClient,
    private logger: FastifyBaseLogger,
  ) {}

  async login(
    identifier: string,
    password: string,
    expiresInSeconds = 1 * 24 * 60 * 60, // 1 day
  ): Promise<{ jwt: string; userId: string }> {
    const users = await this.client.users.getUserList({
      emailAddress: [identifier],
      limit: 1,
    })

    if (users.totalCount === 0) {
      this.logger.error({ identifier }, 'User not found')
      throw new Error('Invalid credentials')
    }

    const { id: userId } = users.data[0]!

    const signInAttempt = await this.client.users.verifyPassword({
      password,
      userId,
    })

    if (!signInAttempt.verified) {
      this.logger.error({ identifier }, 'Invalid password')
      throw new Error('Invalid credentials')
    }

    const session = await this.client.sessions.createSession({ userId })

    const token = await this.client.sessions.getToken(
      session.id,
      env.client.tokenTemplate,
      expiresInSeconds,
    )

    return { jwt: token.jwt, userId }
  }
}
