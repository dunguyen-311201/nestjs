import { Repository } from 'typeorm'
import { beforeEach, describe, expect, it, vi } from 'vitest'

import { CartItem } from '#entities'

import { CartItemRepository } from '../index'

describe('CartItemRepository', () => {
  let cartItemRepository: CartItemRepository
  let mockManager: any
  let mockQueryBuilder: any

  beforeEach(() => {
    mockManager = {
      createQueryBuilder: vi.fn(),
    }

    mockQueryBuilder = {
      delete: vi.fn().mockReturnThis(),
      from: vi.fn().mockReturnThis(),
      where: vi.fn().mockReturnThis(),
      andWhere: vi.fn().mockReturnThis(),
      execute: vi.fn(),
    }

    const fakeRepo = new Repository(CartItem, mockManager)
    cartItemRepository = new CartItemRepository(fakeRepo)

    // Mock inherited methods
    cartItemRepository.findOneBy = vi.fn()
    cartItemRepository.find = vi.fn()
    cartItemRepository.createQueryBuilder = vi
      .fn()
      .mockReturnValue(mockQueryBuilder)
  })

  describe('getCartItemByProduct', () => {
    it('should find cart item by product id and cart id', async () => {
      const mockCartItem = {
        id: 1,
        productId: 'p1',
        cartId: 5,
        product: {} as any,
        quantity: 1,
      } as unknown as CartItem
      ;(cartItemRepository.findOneBy as any).mockResolvedValue(mockCartItem)

      const result = await cartItemRepository.getCartItemByProduct('p1', 5)

      expect(result).toEqual(mockCartItem)
      expect(cartItemRepository.findOneBy).toHaveBeenCalledWith({
        product: { id: 'p1' },
        cartId: 5,
      })
    })

    it('should return null if cart item not found', async () => {
      ;(cartItemRepository.findOneBy as any).mockResolvedValue(null)

      const result = await cartItemRepository.getCartItemByProduct('p1', 5)

      expect(result).toBeNull()
    })
  })

  describe('deleteByCartId', () => {
    it('should delete all cart items by cart id', async () => {
      mockQueryBuilder.execute.mockResolvedValue({ affected: 3 })

      const result = await cartItemRepository.deleteByCartId(5)

      expect(result).toBe(true)
      expect(mockQueryBuilder.delete).toHaveBeenCalled()
      expect(mockQueryBuilder.from).toHaveBeenCalledWith('cart_items')
      expect(mockQueryBuilder.where).toHaveBeenCalledWith('cartId = :cartId', {
        cartId: 5,
      })
    })

    it('should return false if no items deleted', async () => {
      mockQueryBuilder.execute.mockResolvedValue({ affected: 0 })

      const result = await cartItemRepository.deleteByCartId(5)

      expect(result).toBe(false)
    })
  })

  describe('getByCartId', () => {
    it('should get all cart items by cart id with product relation', async () => {
      const mockCartItems = [
        { id: 1, cartId: 5, product: { id: 'p1' } },
        { id: 2, cartId: 5, product: { id: 'p2' } },
      ] as CartItem[]
      ;(cartItemRepository.find as any).mockResolvedValue(mockCartItems)

      const result = await cartItemRepository.getByCartId(5)

      expect(result).toEqual(mockCartItems)
      expect(cartItemRepository.find).toHaveBeenCalledWith({
        where: { cartId: 5 },
        relations: { product: true },
      })
    })

    it('should return empty array if no items found', async () => {
      ;(cartItemRepository.find as any).mockResolvedValue([])

      const result = await cartItemRepository.getByCartId(5)

      expect(result).toEqual([])
    })
  })
})
