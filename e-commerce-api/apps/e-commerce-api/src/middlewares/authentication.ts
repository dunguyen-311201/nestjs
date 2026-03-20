import { getAuth } from '@clerk/fastify'
import type { FastifyRequest } from 'fastify'

import { UnauthorizedError } from '#types'

export const authenticate = async (request: FastifyRequest) => {
  const auth = getAuth(request)

  if (!auth.isAuthenticated) {
    throw new UnauthorizedError('Unauthenticated: Please log in.')
  }

  const { userService } = request.container.services
  const user = await userService.getById(auth.userId)

  if (!user) {
    throw new UnauthorizedError('Unauthenticated: Missing user')
  }

  if (!user.stripeId) {
    const { email, name } = user
    const customer = await userService.createStripeCustomer({
      email,
      name,
    })
    user.stripeId = customer.id
    await userService.save(user)
  }

  Object.assign(request.auth, {
    ...auth,
    userId: user.id,
    stripeId: user.stripeId,
    user,
  })
}

export const authorizeAdmin = async (request: FastifyRequest) => {
  const auth = request.clerk.getAuth(request)

  if (!auth.userId) {
    throw new UnauthorizedError('Unauthenticated: Missing user')
  }

  const response =
    await request.clerk.clerkClient.users.getOrganizationMembershipList({
      userId: auth.userId,
    })

  const isAdmin = response.data.find(({ role }) => role === 'org:admin')

  if (!isAdmin) {
    throw new UnauthorizedError('Access denied: Admin role required.')
  }
}
