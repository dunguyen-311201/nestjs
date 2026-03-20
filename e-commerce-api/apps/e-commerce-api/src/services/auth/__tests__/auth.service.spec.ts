import { FastifyBaseLogger } from 'fastify'
import { beforeEach, describe, expect, it, vi } from 'vitest'

import env from '#env'

import { TCartRepository, TUserRepository } from '#repositories'

import { EmailProvider, PaymentGateway, USER_ROLES } from '#types'

import {
  createMockMailProvider,
  createMockPaymentGateway,
  createMockRepository,
  loggerMock,
} from '#test-utils'

import { User } from '#entities'

import { AuthService } from '../index'

describe('AuthService', () => {
  let authService: AuthService
  let userRepositoryMock: ReturnType<typeof vi.mocked<TUserRepository>>
  let cartRepositoryMock: ReturnType<typeof vi.mocked<TCartRepository>>
  let paymentGatewayProviderMock: PaymentGateway
  let mailProviderMock: EmailProvider
  let logger: FastifyBaseLogger
  let identityProviderMock: any

  const mockUser: User = {
    id: 'user-123',
    email: 'test@example.com',
    name: 'Test User',
    avatar: 'avatar.png',
    firstName: 'Test',
    lastName: 'User',
    username: 'testuser',
    phone: '1234567890',
    age: 30,
    role: USER_ROLES.USER,
    stripeId: 'stripe-customer-123',
    createdAt: new Date(),
    updatedAt: new Date(),
    password: 'password123',
  }

  beforeEach(() => {
    userRepositoryMock = createMockRepository() as any
    cartRepositoryMock = createMockRepository() as any

    paymentGatewayProviderMock = createMockPaymentGateway() as any
    mailProviderMock = createMockMailProvider() as any

    logger = loggerMock as any

    vi.clearAllMocks()

    // Mock env variables
    Object.assign(env, {
      client: {
        baseUrl: 'http://localhost:3000',
        loginPath: '/login',
      },
      mail: {
        fromEmail: 'no-reply@example.com',
        supportEmail: 'support@example.com',
      },
      app: {
        name: 'E-commerce App',
        logoUrl: 'http://localhost:3000/logo.png',
        year: 2026,
      },
    })

    identityProviderMock = {
      login: vi.fn(),
    }

    authService = new AuthService(
      userRepositoryMock,
      cartRepositoryMock,
      paymentGatewayProviderMock,
      mailProviderMock,
      logger,
      identityProviderMock,
    )
  })

  describe('register', () => {
    it('should successfully register a new user and send a confirmation email', async () => {
      // Arrange
      const mockCustomer = { id: 'stripe-customer-123' } as any
      vi.mocked(
        paymentGatewayProviderMock.findOrCreateCustomer,
      ).mockResolvedValue(mockCustomer)
      vi.mocked(userRepositoryMock.save).mockResolvedValue(mockUser)
      vi.mocked(cartRepositoryMock.save).mockResolvedValue({
        id: 1,
        user: mockUser,
        status: 'active',
        items: [],
      } as any)
      vi.mocked(mailProviderMock.send).mockResolvedValue(undefined)

      // Act
      const result = await authService.register(mockUser)

      // Assert
      expect(
        paymentGatewayProviderMock.findOrCreateCustomer,
      ).toHaveBeenCalledWith({
        email: mockUser.email,
        name: mockUser.name,
      })
      expect(userRepositoryMock.save).toHaveBeenCalledWith(
        expect.objectContaining({
          email: mockUser.email,
          stripeId: mockCustomer.id,
        }),
      )
      expect(cartRepositoryMock.save).toHaveBeenCalledWith(
        expect.objectContaining({
          user: mockUser,
          status: 'active',
        }),
      )

      expect(mailProviderMock.send).toHaveBeenCalled()
      expect(logger.info).toHaveBeenCalledWith(
        expect.any(Object),
        'Registering new user',
      )
      expect(result).toEqual(mockUser)
    })

    it('should throw an error if payment gateway fails', async () => {
      vi.mocked(
        paymentGatewayProviderMock.findOrCreateCustomer,
      ).mockRejectedValue(new Error('Stripe error'))

      await expect(authService.register(mockUser)).rejects.toThrow(
        'Stripe error',
      )
    })
  })

  describe('login', () => {
    it('should successfully login and return user with jwt', async () => {
      // Arrange
      const mockJwt = 'mock-jwt-token'
      identityProviderMock.login.mockResolvedValue({
        jwt: mockJwt,
        userId: mockUser.id,
      })
      vi.mocked(userRepositoryMock.getById).mockResolvedValue(mockUser)

      // Act
      const result = await authService.login('test@example.com', 'password123')

      // Assert
      expect(identityProviderMock.login).toHaveBeenCalledWith(
        'test@example.com',
        'password123',
      )
      expect(userRepositoryMock.getById).toHaveBeenCalledWith(mockUser.id)
      expect(result).toEqual({ user: mockUser, jwt: mockJwt })
    })

    it('should throw error if identity provider login fails', async () => {
      identityProviderMock.login.mockRejectedValue(
        new Error('Invalid credentials'),
      )

      await expect(
        authService.login('test@example.com', 'wrong-password'),
      ).rejects.toThrow('Invalid credentials')
    })

    it('should handle case where user is not found in repository after identity provider login', async () => {
      identityProviderMock.login.mockResolvedValue({
        jwt: 'jwt',
        userId: 'non-existent',
      })
      vi.mocked(userRepositoryMock.getById).mockResolvedValue(null)

      const result = await authService.login('test@example.com', 'password')
      expect(result.user).toBeNull()
    })
  })
})
