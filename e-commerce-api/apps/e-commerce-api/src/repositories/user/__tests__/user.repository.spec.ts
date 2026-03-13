import { Repository } from 'typeorm'

import { beforeEach, describe, expect, it, vi } from 'vitest'

import { User } from '#entities'

import { UserRepository } from '../index'

describe('UserRepository', () => {
  let userRepository: UserRepository
  let mockManager: any

  beforeEach(() => {
    mockManager = {
      findOne: vi.fn(),
    }

    const fakeRepo = new Repository(User, mockManager)
    userRepository = new UserRepository(fakeRepo)

    // Mock inherited methods
    userRepository.findOne = vi.fn()
  })

  describe('getById', () => {
    it('should find user by id with cart relation', async () => {
      const mockUser = { id: 'u1' } as User
      ;(userRepository.findOne as any).mockResolvedValue(mockUser)

      const result = await userRepository.getById('u1')

      expect(result).toEqual(mockUser)
      expect(userRepository.findOne).toHaveBeenCalledWith({
        where: { id: 'u1' },
        relations: { cart: true },
      })
    })

    it('should return null if user not found', async () => {
      ;(userRepository.findOne as any).mockResolvedValue(null)

      const result = await userRepository.getById('u1')

      expect(result).toBeNull()
    })
  })

  describe('getUserRelationsById', () => {
    it('should find user with specific relations', async () => {
      const mockUser = { id: 'u1' } as User
      ;(userRepository.findOne as any).mockResolvedValue(mockUser)

      const result = await userRepository.getUserRelationsById('u1')

      expect(result).toEqual(mockUser)
      expect(userRepository.findOne).toHaveBeenCalledWith({
        where: { id: 'u1' },
        relations: { cart: { items: { product: true } } },
      })
    })
  })

  describe('getByStripeId', () => {
    it('should find user by stripe id', async () => {
      const mockUser = { id: 'u1', stripeId: 'stripe_1' } as User
      ;(userRepository.findOne as any).mockResolvedValue(mockUser)

      const result = await userRepository.getByStripeId('stripe_1')

      expect(result).toEqual(mockUser)
      expect(userRepository.findOne).toHaveBeenCalledWith({
        where: { stripeId: 'stripe_1' },
      })
    })
  })
})
