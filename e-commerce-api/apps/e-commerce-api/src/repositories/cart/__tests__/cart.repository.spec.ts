import { Repository } from 'typeorm'
import { beforeEach, describe, expect, it, vi } from 'vitest'

import { Cart } from '#entities'

import { CartRepository } from '../index'

describe('CartRepository', () => {
  let cartRepository: CartRepository
  let mockManager: any
  let mockQueryBuilder: any

  beforeEach(() => {
    mockManager = {
      createQueryBuilder: vi.fn(),
    }

    mockQueryBuilder = {
      leftJoinAndSelect: vi.fn().mockReturnThis(),
      where: vi.fn().mockReturnThis(),
      getOne: vi.fn(),
    }

    const fakeRepo = new Repository(Cart, mockManager)
    cartRepository = new CartRepository(fakeRepo)

    // Mock inherited methods
    cartRepository.createQueryBuilder = vi
      .fn()
      .mockReturnValue(mockQueryBuilder)
  })

  describe('getCartByUserId', () => {
    it('should find cart by user id with relations', async () => {
      const mockCart = {
        id: 1,
        user: {} as any,
        status: 'active' as const,
        items: [],
        createdAt: new Date(),
        updatedAt: new Date(),
      } as unknown as Cart
      mockQueryBuilder.getOne.mockResolvedValue(mockCart)

      const result = await cartRepository.getCartByUserId('u1')

      expect(result).toEqual(mockCart)
      expect(cartRepository.createQueryBuilder).toHaveBeenCalledWith('cart')
      expect(mockQueryBuilder.leftJoinAndSelect).toHaveBeenCalledWith(
        'cart.items',
        'cartItem',
      )
      expect(mockQueryBuilder.leftJoinAndSelect).toHaveBeenCalledWith(
        'cartItem.product',
        'product',
      )
      expect(mockQueryBuilder.leftJoinAndSelect).toHaveBeenCalledWith(
        'cart.user',
        'user',
      )
      expect(mockQueryBuilder.where).toHaveBeenCalledWith('user.id = :userId', {
        userId: 'u1',
      })
    })

    it('should return null if cart not found', async () => {
      mockQueryBuilder.getOne.mockResolvedValue(null)

      const result = await cartRepository.getCartByUserId('u1')

      expect(result).toBeNull()
    })
  })
})
