import { FastifyReply, FastifyRequest } from 'fastify'
import { beforeEach, describe, expect, it, vi } from 'vitest'

import { IAuthService } from '#services/types'

import { BadRequestError } from '#types'

import { createMockReply, createMockRequest } from '#test-utils'

import { AuthController } from '../index'

// Mock dependencies
const mockAuthService = {
  register: vi.fn(),
}

// Mock utils and dtos if needed, but for unit tests it's better to mock the service behavior
vi.mock('#dtos/user', () => ({
  transformatFromClerk: vi.fn((body) => ({ ...body })),
}))

vi.mock('#utils/clerk', () => ({
  isClerkAPIResponseError: vi.fn(
    (error: any) => error?.message === 'ClerkError',
  ),
}))

describe('AuthController', () => {
  let authController: AuthController
  let mockRequest: FastifyRequest
  let mockReply: FastifyReply

  beforeEach(() => {
    vi.clearAllMocks()

    authController = new AuthController(
      mockAuthService as unknown as IAuthService,
    )

    mockRequest = createMockRequest({
      body: {
        id: 'user_123',
        email_addresses: [{ email_address: 'test@example.com' }],
      },
      log: {
        info: vi.fn(),
        error: vi.fn(),
      } as any,
    })

    mockReply = createMockReply()
  })

  describe('register', () => {
    it('should register a new user successfully', async () => {
      const mockUser = { id: 'user_123', email: 'test@example.com' }
      mockAuthService.register.mockResolvedValue(mockUser)

      await authController.register(
        mockRequest as FastifyRequest<any>,
        mockReply as FastifyReply,
      )

      expect(mockAuthService.register).toHaveBeenCalled()
      expect(mockReply.send).toHaveBeenCalledWith(mockUser)
    })

    it('should handle generic errors', async () => {
      const error = new Error('Database error')
      mockAuthService.register.mockRejectedValue(error)

      await expect(
        authController.register(
          mockRequest as FastifyRequest<any>,
          mockReply as FastifyReply,
        ),
      ).rejects.toThrow('Database error')
      expect(mockRequest.log?.info).toHaveBeenCalled()
    })

    it('should handle Clerk API errors', async () => {
      const clerkError = {
        message: 'ClerkError',
        errors: [{ message: 'Invalid token' }],
      }
      mockAuthService.register.mockRejectedValue(clerkError)

      // Mock isClerkAPIResponseError behavior explicitly for this test if needed,
      // but the global mock above should handle it if implemented correctly.
      // However, we rely on the imported mocked function which verifies 'ClerkError'

      await expect(
        authController.register(
          mockRequest as FastifyRequest<any>,
          mockReply as FastifyReply,
        ),
      ).rejects.toThrow(BadRequestError)

      await expect(
        authController.register(
          mockRequest as FastifyRequest<any>,
          mockReply as FastifyReply,
        ),
      ).rejects.toThrow('Invalid token')
    })
  })
})
