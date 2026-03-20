import { beforeEach, describe, expect, it, vi } from 'vitest'

import { NotFoundError } from '#types'

import {
  createMockQueryRunner,
  createMockRepository,
  loggerMock,
} from '#test-utils'

import { OrderService } from '../index'

describe('OrderService', () => {
  let orderService: OrderService
  let orderRepositoryMock: ReturnType<typeof createMockRepository>
  let cartRepositoryMock: ReturnType<typeof createMockRepository>
  let queryRunnerMock: ReturnType<typeof createMockQueryRunner>

  beforeEach(() => {
    vi.clearAllMocks()

    queryRunnerMock = createMockQueryRunner()

    orderRepositoryMock = createMockRepository({
      findOrdersByUserId: vi.fn(),
      findOrders: vi.fn(),
    })

    cartRepositoryMock = createMockRepository({
      getCartByUserId: vi.fn(),
    })
    cartRepositoryMock.manager.connection.createQueryRunner.mockReturnValue(
      queryRunnerMock,
    )

    orderService = new OrderService(orderRepositoryMock as any, loggerMock)
  })

  // createOrder tests removed as method does not exist in OrderService

  describe('getOrdersByUserId', () => {
    it('should fetch orders with pagination', async () => {
      const userId = 'user-1'
      const params = { page: 1, pageSize: 10, categories: [] }
      const mockOrders = [{ id: 1 }, { id: 2 }]
      orderRepositoryMock.findOrdersByUserId.mockResolvedValue([2, mockOrders])

      const result = await orderService.getOrdersByUserId(userId, params)

      expect(result.data).toEqual(mockOrders)
      expect(result.meta.pagination.totalItems).toBe(2)
      expect(orderRepositoryMock.findOrdersByUserId).toHaveBeenCalledWith(
        userId,
        params,
      )
    })
  })

  describe('getOrders', () => {
    it('should fetch all orders with pagination (admin)', async () => {
      const params = { page: 1, pageSize: 10, categories: [] }
      const mockOrders = [
        { id: 1, user: { id: 'user-1' } },
        { id: 2, user: { id: 'user-2' } },
      ]
      orderRepositoryMock.findOrders.mockResolvedValue([2, mockOrders])

      const result = await orderService.getOrders(params)

      expect(result.data).toEqual(mockOrders)
      expect(result.meta.pagination.totalItems).toBe(2)
      expect(result.meta.pagination.currentPage).toBe(1)
      expect(result.meta.pagination.totalPages).toBe(1)
      expect(orderRepositoryMock.findOrders).toHaveBeenCalledWith(params)
      expect(loggerMock.info).toHaveBeenCalledWith(
        { page: params.page, pageSize: params.pageSize },
        'Fetching all orders (admin)',
      )
    })
  })

  describe('updateOrderStatus', () => {
    it('should update status and return order', async () => {
      const orderId = 1
      const userId = 'user-1'
      const status = 'delivered'
      const mockOrder = { id: orderId, status: 'pending' }
      orderRepositoryMock.findOne.mockResolvedValue(mockOrder)

      const result = await orderService.updateOrderStatus(
        { orderId, userId },
        status,
      )

      expect(orderRepositoryMock.save).toHaveBeenCalled()
      expect(result?.status).toBe(status)
    })

    it('should throw NotFoundError if order not found', async () => {
      const orderId = 1
      const userId = 'user-1'
      orderRepositoryMock.findOne.mockResolvedValue(null)

      await expect(
        orderService.updateOrderStatus({ orderId, userId }, 'delivered'),
      ).rejects.toThrow(NotFoundError)
    })

    it('should prevent cancellation if order is not pending', async () => {
      const orderId = 1
      const userId = 'user-1'
      const status = 'cancelled'
      // Order is already delivered, cannot cancel
      const mockOrder = { id: orderId, status: 'delivered' }
      orderRepositoryMock.findOne.mockResolvedValue(mockOrder)

      await expect(
        orderService.updateOrderStatus({ orderId, userId }, status),
      ).rejects.toThrow('Order cannot be cancelled')
    })

    it('should handle database errors during save', async () => {
      const orderId = 1
      const userId = 'user-1'
      const status = 'delivered'
      const mockOrder = { id: orderId, status: 'pending' }
      orderRepositoryMock.findOne.mockResolvedValue(mockOrder)
      const error = new Error('Save failed')
      orderRepositoryMock.save.mockRejectedValue(error)

      await expect(
        orderService.updateOrderStatus({ orderId, userId }, status),
      ).rejects.toThrow(error)
    })
  })

  describe('getOrders', () => {
    it('should fetch all orders with pagination (admin)', async () => {
      const params = { page: 1, pageSize: 10, categories: [] }
      const mockOrders = [
        { id: 1, user: { id: 'user-1' } },
        { id: 2, user: { id: 'user-2' } },
      ]
      orderRepositoryMock.findOrders.mockResolvedValue([2, mockOrders])

      const result = await orderService.getOrders(params)

      expect(result.data).toEqual(mockOrders)
      expect(result.meta.pagination.totalItems).toBe(2)
      expect(result.meta.pagination.currentPage).toBe(1)
      expect(result.meta.pagination.totalPages).toBe(1)
      expect(orderRepositoryMock.findOrders).toHaveBeenCalledWith(params)
      expect(loggerMock.info).toHaveBeenCalledWith(
        { page: params.page, pageSize: params.pageSize },
        'Fetching all orders (admin)',
      )
    })

    it('should handle database errors in getOrders', async () => {
      const params = { page: 1, pageSize: 10, categories: [] }
      const error = new Error('DB Error')
      orderRepositoryMock.findOrders.mockRejectedValue(error)

      await expect(orderService.getOrders(params)).rejects.toThrow(error)
      // Verify logger call if exists in catch block, or just that it bubbles up
    })
  })
})
