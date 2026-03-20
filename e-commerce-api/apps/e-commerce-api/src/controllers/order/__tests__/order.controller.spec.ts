import { FastifyRequest } from 'fastify'
import { beforeEach, describe, expect, it, vi } from 'vitest'

import { IOrderService } from '#services/types'

import { createMockReply, createMockRequest } from '#test-utils'

import { OrderController } from '../index'

// Mock dependencies
const mockOrderService = {
  getOrdersByUserId: vi.fn(),
}

vi.mock('#dtos/order', () => ({
  formatOrderDto: vi.fn((order) => ({ ...order, formatted: true })),
}))

describe('OrderController', () => {
  let orderController: OrderController

  beforeEach(() => {
    vi.clearAllMocks()

    orderController = new OrderController(
      mockOrderService as unknown as IOrderService,
    )
  })

  describe('getOrders', () => {
    it('should retrieve orders successfully', async () => {
      const mockRequest = createMockRequest<
        FastifyRequest<{
          Querystring: { page: number; pageSize: number }
        }>
      >({
        auth: {
          userId: 'user_123',
          orgRole: 'user',
          stripeId: 'stripe_123',
          user: {},
        },
        query: { page: 1, pageSize: 10 },
      })
      const mockReply = createMockReply()
      const mockOrders = [{ id: 1 }, { id: 2 }]
      const mockMeta = { total: 2 }
      mockOrderService.getOrdersByUserId.mockResolvedValue({
        data: mockOrders,
        meta: mockMeta,
      })

      await orderController.getOrders(mockRequest, mockReply)

      expect(mockOrderService.getOrdersByUserId).toHaveBeenCalledWith(
        'user_123',
        {
          page: 1,
          pageSize: 10,
        },
      )
      expect(mockReply.send).toHaveBeenCalledWith({
        data: [
          { id: 1, formatted: true },
          { id: 2, formatted: true },
        ],
        meta: mockMeta,
      })
    })

    it('should handle missing query params', async () => {
      const mockRequest = createMockRequest<
        FastifyRequest<{
          Querystring: { page: number; pageSize: number }
        }>
      >({
        auth: {
          userId: 'user_123',
          orgRole: 'user',
          stripeId: 'stripe_123',
          user: {},
        },
        query: {} as any, // Missing params
      })
      const mockReply = createMockReply()
      const mockOrders: any[] = []
      const mockMeta = { total: 0 }
      mockOrderService.getOrdersByUserId.mockResolvedValue({
        data: mockOrders,
        meta: mockMeta,
      })

      await orderController.getOrders(mockRequest, mockReply)

      expect(mockOrderService.getOrdersByUserId).toHaveBeenCalledWith(
        'user_123',
        {
          page: undefined,
          pageSize: undefined,
        },
      )
    })
  })
})
