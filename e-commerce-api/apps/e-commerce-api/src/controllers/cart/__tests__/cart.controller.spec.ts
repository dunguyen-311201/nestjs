import { FastifyRequest } from 'fastify'
import { beforeEach, describe, expect, it, vi } from 'vitest'

import { ICartService } from '#services/types'

import { HttpStatus } from '#types'

import { CartItemDto } from '#dtos/cart-item'

import { createMockReply, createMockRequest } from '#test-utils'

import { CartItem, Product } from '#entities'

import { CartController } from '../index'

const mockCartService = {
  getCartByUserId: vi.fn(),
  addProductToCart: vi.fn(),
  removeProductFromCart: vi.fn(),
}

describe('CartController', () => {
  let cartController: CartController

  beforeEach(() => {
    vi.clearAllMocks()

    cartController = new CartController(
      mockCartService as unknown as ICartService,
    )
  })

  describe('getCart', () => {
    it('should retrieve cart successfully', async () => {
      const mockRequest = createMockRequest<FastifyRequest>({
        auth: {
          userId: 'user_123',
          orgRole: 'user',
          stripeId: 'stripe_123',
          user: {},
        },
      })
      const mockReply = createMockReply()
      const mockCart = { id: 1, items: [] }
      mockCartService.getCartByUserId.mockResolvedValue(mockCart)

      await cartController.getCart(mockRequest, mockReply)

      expect(mockCartService.getCartByUserId).toHaveBeenCalledWith('user_123')
      expect(mockReply.send).toHaveBeenCalledWith({
        id: 1,
        items: [],
        status: undefined,
        total: 0,
      })
    })
  })

  describe('addProductToCart', () => {
    it('should add product to cart successfully', async () => {
      const mockRequest = createMockRequest<
        FastifyRequest<{
          Body: { productId: string; quantity: number }
        }>
      >({
        auth: {
          userId: 'user_123',
          orgRole: 'user',
          stripeId: 'stripe_123',
          user: {},
        },
        body: { productId: 'p1', quantity: 1 },
      })
      const mockReply = createMockReply()
      const mockCartItem = {
        id: 1,
        quantity: 1,
        product: {
          name: 'product',
          images: ['http://'],
          stock: 2,
          price: 32,
          status: 'archived',
        } as Product,
      } as CartItem
      mockCartService.addProductToCart.mockResolvedValue(mockCartItem)

      await cartController.addProductToCart(mockRequest, mockReply)

      expect(mockCartService.addProductToCart).toHaveBeenCalledWith({
        userId: 'user_123',
        productId: 'p1',
        quantity: 1,
      })
      expect(mockReply.send).toHaveBeenCalledWith(new CartItemDto(mockCartItem))
    })
  })

  describe('removeProductFromCart', () => {
    it('should remove product from cart successfully', async () => {
      const mockRequest = createMockRequest<
        FastifyRequest<{
          Params: { id: string }
        }>
      >({
        auth: {
          userId: 'user_123',
          orgRole: 'user',
          stripeId: 'stripe_123',
          user: {},
        },
        params: { id: '1' },
      })
      const mockReply = createMockReply()
      mockCartService.removeProductFromCart.mockResolvedValue(undefined)

      await cartController.removeProductFromCart(mockRequest, mockReply)

      expect(mockCartService.removeProductFromCart).toHaveBeenCalledWith(
        1,
        'user_123',
      )
      expect(mockReply.status).toHaveBeenCalledWith(HttpStatus.NO_CONTENT)
      expect(mockReply.send).toHaveBeenCalled()
    })
  })
})
