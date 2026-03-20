import { beforeEach, describe, expect, it, vi } from 'vitest'

import { USER_ROLES } from '#types'

import {
  createMockPaymentGateway,
  createMockRepository,
  loggerMock,
} from '#test-utils'

import { UserService } from '../index'

describe('UserService', () => {
  let userService: UserService
  let userRepositoryMock: ReturnType<typeof createMockRepository>
  let paymentGatewayProviderMock: ReturnType<typeof createMockPaymentGateway>

  beforeEach(() => {
    vi.clearAllMocks()

    userRepositoryMock = createMockRepository({
      getById: vi.fn(),
      findOneBy: vi.fn(),
    })
    paymentGatewayProviderMock = createMockPaymentGateway()

    userService = new UserService(
      userRepositoryMock as any,
      paymentGatewayProviderMock as any,
      loggerMock,
    )
  })

  describe('addRoleForUser', () => {
    it('should add role to user if user exists', async () => {
      const userId = 'user-1'
      const role = USER_ROLES.ADMIN
      const mockUser = { id: userId, role: USER_ROLES.USER }
      const updatedUser = { ...mockUser, role }
      userRepositoryMock.getById.mockResolvedValue(mockUser)
      userRepositoryMock.save.mockResolvedValue(updatedUser)

      const result = await userService.addRoleForUser(userId, role)

      expect(result).toEqual(updatedUser)
      expect(userRepositoryMock.save).toHaveBeenCalledWith(
        expect.objectContaining({ role }),
      )
      expect(loggerMock.info).toHaveBeenCalledWith(
        { userId, role },
        'Role added to user successfully',
      )
    })

    it('should throw error if user not found', async () => {
      const userId = 'user-1'
      const role = USER_ROLES.ADMIN
      userRepositoryMock.getById.mockResolvedValue(null)

      await expect(userService.addRoleForUser(userId, role)).rejects.toThrow(
        'User not found',
      )
      expect(userRepositoryMock.save).not.toHaveBeenCalled()
      expect(loggerMock.warn).toHaveBeenCalled()
    })

    it('should handle repository errors', async () => {
      const userId = 'user-1'
      const role = USER_ROLES.ADMIN
      const mockUser = { id: userId, role: USER_ROLES.USER }
      userRepositoryMock.getById.mockResolvedValue(mockUser)
      userRepositoryMock.save.mockRejectedValue(new Error('DB Error'))

      await expect(userService.addRoleForUser(userId, role)).rejects.toThrow(
        'DB Error',
      )
    })
  })

  describe('getById', () => {
    it('should fetch user by id', async () => {
      const userId = 'user-1'
      const mockUser = { id: userId }
      userRepositoryMock.findOneBy.mockResolvedValue(mockUser)

      const result = await userService.getById(userId)

      expect(result).toEqual(mockUser)
      expect(userRepositoryMock.findOneBy).toHaveBeenCalledWith({ id: userId })
    })
  })

  describe('save', () => {
    it('should save user', async () => {
      const mockUser = { id: 'user-1', email: 'test@example.com' } as any
      userRepositoryMock.save.mockResolvedValue(mockUser)

      const result = await userService.save(mockUser)

      expect(result).toEqual(mockUser)
      expect(userRepositoryMock.save).toHaveBeenCalledWith(mockUser)
    })
  })

  describe('createStripeCustomer', () => {
    it('should create stripe customer', async () => {
      const params = { email: 'test@example.com', name: 'Test' }
      const mockCustomer = { id: 'cus-1', ...params }
      paymentGatewayProviderMock.createCustomer.mockResolvedValue(mockCustomer)

      const result = await userService.createStripeCustomer(params)

      expect(result).toEqual(mockCustomer)
      expect(paymentGatewayProviderMock.createCustomer).toHaveBeenCalledWith(
        params,
      )
    })

    it('should handle errors in createStripeCustomer', async () => {
      const params = { email: 'test@example.com', name: 'Test' }
      const error = new Error('Stripe Error')
      paymentGatewayProviderMock.createCustomer.mockRejectedValue(error)

      await expect(userService.createStripeCustomer(params)).rejects.toThrow(
        error,
      )
    })
  })
})
