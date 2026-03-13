import { Repository } from 'typeorm'
import { beforeEach, describe, expect, it, vi } from 'vitest'

import { Order } from '#entities'

import { OrderRepository } from '../index'

describe('OrderRepository', () => {
  let orderRepository: OrderRepository
  let mockManager: any

  beforeEach(() => {
    mockManager = {
      findOne: vi.fn(),
      findAndCount: vi.fn(),
      create: vi.fn(),
      save: vi.fn(),
    }

    const fakeRepo = new Repository(Order, mockManager)
    orderRepository = new OrderRepository(fakeRepo)

    // Mock inherited methods
    orderRepository.findOne = vi.fn()
    orderRepository.findAndCount = vi.fn()
  })

  describe('findPendingOrder', () => {
    it('should find pending order for user', async () => {
      const mockOrder = {
        id: 'o1',
        status: 'pending' as const,
        totalAmount: 100,
        invoiceId: null,
        createdAt: new Date(),
        updatedAt: new Date(),
      } as unknown as Order
      ;(orderRepository.findOne as any).mockResolvedValue(mockOrder)

      const result = await orderRepository.findPendingOrder('u1')

      expect(result).toEqual(mockOrder)
      expect(orderRepository.findOne).toHaveBeenCalledWith({
        where: { user: { id: 'u1' }, status: 'pending' },
        relations: { items: { product: true } },
      })
    })

    it('should return null if no pending order', async () => {
      ;(orderRepository.findOne as any).mockResolvedValue(null)

      const result = await orderRepository.findPendingOrder('u1')

      expect(result).toBeNull()
    })
  })

  describe('findOrdersByUserId', () => {
    it('should find orders for user with pagination', async () => {
      const mockOrders = [
        {
          id: 'o1',
          status: 'pending' as const,
          totalAmount: 100,
          invoiceId: null,
          createdAt: new Date(),
          updatedAt: new Date(),
        },
      ] as unknown as Order[]
      const mockCount = 1
      ;(orderRepository.findAndCount as any).mockResolvedValue([
        mockOrders,
        mockCount,
      ])

      const result = await orderRepository.findOrdersByUserId('u1', {
        page: 1,
        pageSize: 10,
      } as any)

      expect(result).toEqual([mockCount, mockOrders])
    })
  })

  describe('createOrder', () => {
    it('should create order using query runner', async () => {
      const mockQueryRunner = {
        manager: {
          create: vi.fn(),
          save: vi.fn(),
        },
      } as any

      const orderData = {
        id: 'o1',
        status: 'pending' as const,
        totalAmount: 100,
        invoiceId: null,
        createdAt: new Date(),
        updatedAt: new Date(),
      } as unknown as Order
      const createdOrder = { ...orderData, user: { id: 'u1' } }

      mockQueryRunner.manager.create.mockReturnValue(createdOrder)
      mockQueryRunner.manager.save.mockResolvedValue(createdOrder)

      const result = await orderRepository.createOrder(
        mockQueryRunner,
        'u1',
        orderData,
      )

      expect(result).toEqual(createdOrder)
      expect(mockQueryRunner.manager.create).toHaveBeenCalledWith(Order, {
        ...orderData,
        user: { id: 'u1' },
      })
      expect(mockQueryRunner.manager.save).toHaveBeenCalledWith(createdOrder)
    })
  })
})
