import { FastifyRequest } from 'fastify'
import { beforeEach, describe, expect, it, vi } from 'vitest'

import { IOrderService } from '#services/types'

import { createMockReply, createMockRequest } from '#test-utils'

import { AdminOrderController } from '../index'

// Mock dependencies
const mockOrderService = {
  getOrders: vi.fn(),
  updateOrderStatus: vi.fn(),
}

vi.mock('#dtos/order', () => ({
  formatOrderDto: vi.fn((order) => ({ ...order, formatted: true })),
}))

describe('AdminOrderController', () => {
  let adminOrderController: AdminOrderController

  beforeEach(() => {
    vi.clearAllMocks()

    adminOrderController = new AdminOrderController(
      mockOrderService as unknown as IOrderService,
    )
  })

  describe('getAllOrders', () => {
    it('should retrieve all orders successfully', async () => {
      const mockRequest = createMockRequest<
        FastifyRequest<{
          Querystring: { page: number; pageSize: number }
        }>
      >({
        query: { page: 1, pageSize: 10 },
      })
      const mockReply = createMockReply()
      const mockResult = {
        data: [{ id: 1 }, { id: 2 }],
        meta: { total: 2 },
      }
      mockOrderService.getOrders.mockResolvedValue(mockResult)

      await adminOrderController.getAllOrders(mockRequest, mockReply)

      expect(mockOrderService.getOrders).toHaveBeenCalledWith({
        page: 1,
        pageSize: 10,
      })
      expect(mockReply.send).toHaveBeenCalledWith({
        data: [
          { id: 1, formatted: true },
          { id: 2, formatted: true },
        ],
        meta: { total: 2 },
      })
    })
  })

  describe('updateOrderStatus', () => {
    it('should update order status successfully', async () => {
      const mockRequest = createMockRequest<
        FastifyRequest<{
          Params: { id: string }
          Body: {
            status:
              | 'pending'
              | 'processing'
              | 'shipped'
              | 'delivered'
              | 'cancelled'
          }
        }>
      >({
        params: { id: '1' },
        body: { status: 'shipped' },
      })
      const mockReply = createMockReply()
      const mockOrder = { id: 1, status: 'shipped' }
      mockOrderService.updateOrderStatus.mockResolvedValue(mockOrder)

      await adminOrderController.updateOrderStatus(mockRequest, mockReply)

      expect(mockOrderService.updateOrderStatus).toHaveBeenCalledWith(
        {
          orderId: 1,
        },
        'shipped',
      )
      expect(mockReply.send).toHaveBeenCalledWith({
        id: 1,
        status: 'shipped',
        formatted: true,
      })
    })
  })
})
