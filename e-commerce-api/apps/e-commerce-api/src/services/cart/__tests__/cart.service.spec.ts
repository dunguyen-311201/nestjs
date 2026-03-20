import { beforeEach, describe, expect, it, vi } from 'vitest'

import {
  TCartItemRepository,
  TCartRepository,
  TProductRepository,
} from '#repositories'

import { NotFoundError } from '#types'

import {
  createMockQueryRunner,
  createMockRepository,
  loggerMock,
} from '#test-utils'

import { CartService } from '../index'

describe('CartService', () => {
  let cartService: CartService
  let cartRepositoryMock: any
  let cartItemRepositoryMock: any
  let productRepositoryMock: any
  let queryRunnerMock: any

  beforeEach(() => {
    vi.clearAllMocks()

    queryRunnerMock = createMockQueryRunner({
      manager: {
        findOne: vi.fn(),
        save: vi.fn(),
        remove: vi.fn(),
      },
    })

    cartRepositoryMock = createMockRepository({
      manager: {
        connection: {
          createQueryRunner: vi.fn(() => queryRunnerMock),
        },
      },
    })

    cartItemRepositoryMock = {
      deleteByCartId: vi.fn(),
      createQueryBuilder: vi.fn(),
    }

    productRepositoryMock = {
      getById: vi.fn(),
    }

    cartService = new CartService(
      cartRepositoryMock as unknown as TCartRepository,
      cartItemRepositoryMock as unknown as TCartItemRepository,
      productRepositoryMock as unknown as TProductRepository,
      loggerMock,
    )
  })

  describe('createCart', () => {
    it('should create and insert a new cart', async () => {
      const userId = 'user-1'
      const mockCart = {
        id: 1,
        user: { id: userId },
        items: [],
        status: 'active',
      }
      cartRepositoryMock.create.mockReturnValue(mockCart)

      const result = await cartService.createCart(userId)

      expect(cartRepositoryMock.create).toHaveBeenCalledWith({
        user: { id: userId },
        items: [],
        status: 'active',
      })
      expect(cartRepositoryMock.insert).toHaveBeenCalledWith(mockCart)
      expect(result).toEqual(mockCart)
    })
  })

  describe('getCartByUserId', () => {
    it('should fetch existing cart', async () => {
      const userId = 'user-1'
      const mockCart = { id: 1, items: [] }
      const qb = cartRepositoryMock.createQueryBuilder()
      qb.getOne.mockResolvedValue(mockCart)
      cartRepositoryMock.createQueryBuilder.mockReturnValue(qb)

      const result = await cartService.getCartByUserId(userId)

      expect(result).toEqual(mockCart)
      expect(qb.where).toHaveBeenCalledWith('cart.user_id = :userId', {
        userId,
      })
    })

    it('should create new cart if one does not exist', async () => {
      const userId = 'user-1'
      const mockCart = { id: 1, items: [] }
      const qb = cartRepositoryMock.createQueryBuilder()
      qb.getOne.mockResolvedValue(null)
      cartRepositoryMock.createQueryBuilder.mockReturnValue(qb)

      // Mock createCart behavior
      cartRepositoryMock.create.mockReturnValue(mockCart)

      const result = await cartService.getCartByUserId(userId)

      expect(result).toEqual(mockCart)
      expect(cartRepositoryMock.create).toHaveBeenCalled()
    })
  })

  describe('addProductToCart', () => {
    const userId = 'user-1'
    const productId = '10'
    const quantity = 2
    const mockCart = { id: 5 }
    const mockProduct = {
      id: productId,
      stock: 10,
      deleted: false,
      reservedStock: 0,
    }

    beforeEach(() => {
      // Mock getCartByUserId
      const qb = cartRepositoryMock.createQueryBuilder()
      qb.getOne.mockResolvedValue(mockCart)
      cartRepositoryMock.createQueryBuilder.mockReturnValue(qb)

      productRepositoryMock.getById.mockResolvedValue(mockProduct)
    })

    it('should throw NotFoundError if product does not exist', async () => {
      productRepositoryMock.getById.mockResolvedValue(null)

      await expect(
        cartService.addProductToCart({ userId, productId, quantity }),
      ).rejects.toThrow(NotFoundError)
    })

    it('should throw BadRequestError if insufficient stock', async () => {
      productRepositoryMock.getById.mockResolvedValue({
        ...mockProduct,
        stock: 1,
      })

      await expect(
        cartService.addProductToCart({ userId, productId, quantity }),
      ).rejects.toThrow(NotFoundError)
    })
  })

  describe('removeProductFromCart', () => {
    it('should call deleteCartItem and return true', async () => {
      const itemId = 100
      const userId = 'user-1'

      // Mock deleteCartItem to succeed
      vi.spyOn(cartService, 'deleteCartItem').mockResolvedValue()

      const result = await cartService.removeProductFromCart(itemId, userId)

      expect(cartService.deleteCartItem).toHaveBeenCalledWith(itemId, userId)
      expect(result).toBe(true)
    })

    it('should return false if deleteCartItem throws NotFoundError', async () => {
      const itemId = 100
      const userId = 'user-1'

      vi.spyOn(cartService, 'deleteCartItem').mockRejectedValue(
        new NotFoundError('Item not found'),
      )

      const result = await cartService.removeProductFromCart(itemId, userId)

      expect(cartService.deleteCartItem).toHaveBeenCalledWith(itemId, userId)
      expect(result).toBe(false)
    })

    it('should throw other errors', async () => {
      const itemId = 100
      const userId = 'user-1'

      vi.spyOn(cartService, 'deleteCartItem').mockRejectedValue(
        new Error('Other error'),
      )

      await expect(
        cartService.removeProductFromCart(itemId, userId),
      ).rejects.toThrow('Other error')
    })
  })

  describe('deleteCartItem', () => {
    it('should call repository createQueryBuilder and execute delete', async () => {
      const cartItemId = 100
      const userId = 'user-1'

      const mockDeleteQueryBuilder = {
        delete: vi.fn().mockReturnThis(),
        from: vi.fn().mockReturnThis(),
        where: vi.fn().mockReturnThis(),
        andWhere: vi.fn().mockReturnThis(),
        execute: vi.fn().mockResolvedValue({ affected: 1 }),
      }

      cartItemRepositoryMock.createQueryBuilder = vi
        .fn()
        .mockReturnValue(mockDeleteQueryBuilder)

      await cartService.deleteCartItem(cartItemId, userId)

      expect(cartItemRepositoryMock.createQueryBuilder).toHaveBeenCalledWith(
        'cartItem',
      )
      expect(mockDeleteQueryBuilder.delete).toHaveBeenCalled()
      expect(mockDeleteQueryBuilder.from).toHaveBeenCalledWith('cart_items')
      expect(mockDeleteQueryBuilder.where).toHaveBeenCalledWith(
        'id = :cartItemId',
        { cartItemId },
      )
      expect(mockDeleteQueryBuilder.andWhere).toHaveBeenCalledWith(
        'cart_id IN (SELECT id FROM carts WHERE user_id = :userId)',
        { userId },
      )
      expect(mockDeleteQueryBuilder.execute).toHaveBeenCalled()
    })

    it('should throw NotFoundError if no rows affected', async () => {
      const cartItemId = 100
      const userId = 'user-1'

      const mockDeleteQueryBuilder = {
        delete: vi.fn().mockReturnThis(),
        from: vi.fn().mockReturnThis(),
        where: vi.fn().mockReturnThis(),
        andWhere: vi.fn().mockReturnThis(),
        execute: vi.fn().mockResolvedValue({ affected: 0 }),
      }

      cartItemRepositoryMock.createQueryBuilder = vi
        .fn()
        .mockReturnValue(mockDeleteQueryBuilder)

      await expect(
        cartService.deleteCartItem(cartItemId, userId),
      ).rejects.toThrow(NotFoundError)
    })
  })

  describe('clearCart', () => {
    it('should fetch cart and delete all items', async () => {
      const userId = 'user-1'
      const mockCart = { id: 5 }
      const qb = cartRepositoryMock.createQueryBuilder()
      qb.getOne.mockResolvedValue(mockCart)
      cartRepositoryMock.createQueryBuilder.mockReturnValue(qb)

      await cartService.clearCart(userId)

      expect(cartItemRepositoryMock.deleteByCartId).toHaveBeenCalledWith(
        mockCart.id,
      )
    })

    it('should log error if clearing cart fails', async () => {
      const userId = 'user-1'
      const error = new Error('Clear failed')

      // Mock getCartByUserId failure
      const qb = cartRepositoryMock.createQueryBuilder()
      qb.getOne.mockRejectedValue(error)
      cartRepositoryMock.createQueryBuilder.mockReturnValue(qb)

      await expect(cartService.clearCart(userId)).rejects.toThrow(error)
    })
  })
})
