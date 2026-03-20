import { beforeEach, describe, expect, it, vi } from 'vitest'

import { InvoiceMail } from '#services/invoice-mail/index'

import { TOrderRepository, TUserRepository } from '#repositories'

import { PaymentGateway } from '#types'

import {
  createMockInventoryService,
  createMockMailProvider,
  createMockPaymentGateway,
  createMockQueryRunner,
  createMockRepository,
  loggerMock,
} from '#test-utils'

import { CheckoutService } from '../index'

describe('CheckoutService', () => {
  let checkoutService: CheckoutService
  let userRepositoryMock: any
  let orderRepositoryMock: any
  let queryRunnerMock: any
  let paymentGatewayProviderMock: any
  let mailProviderMock: any
  let inventoryServiceMock: any
  let invoiceMailMock: any

  beforeEach(() => {
    vi.clearAllMocks()

    queryRunnerMock = createMockQueryRunner()

    userRepositoryMock = createMockRepository({
      getByStripeId: vi.fn(),
    })

    orderRepositoryMock = createMockRepository({
      createOrder: vi.fn(),
      hasPendingOrder: vi.fn(),
      manager: {
        connection: {
          createQueryRunner: vi.fn(() => queryRunnerMock),
        },
      },
    })

    paymentGatewayProviderMock = createMockPaymentGateway()
    mailProviderMock = createMockMailProvider()
    invoiceMailMock = new InvoiceMail(mailProviderMock, loggerMock)

    inventoryServiceMock = createMockInventoryService()

    checkoutService = new CheckoutService(
      userRepositoryMock as unknown as TUserRepository,
      orderRepositoryMock as unknown as TOrderRepository,
      inventoryServiceMock,
      paymentGatewayProviderMock as unknown as PaymentGateway,
      invoiceMailMock,
      loggerMock,
    )
  })

  describe('generatePaymentIntent', () => {
    const userId = 'user-1'
    const userStripeId = 'cus-1'
    const payload = { currency: 'usd' } as any

    it('should throw error if product is out of stock', async () => {
      const mockProduct = {
        id: 'p1',
        price: 100,
        name: 'P1',
        stock: 1, // Limited stock
        reservedStock: 0,
        status: 'published',
      }
      const mockCart = {
        id: 1,
        status: 'active',
        items: [
          {
            product: mockProduct,
            quantity: 5, // Requesting more than available
            productId: 'p1',
          },
        ],
      }

      const mockQueryBuilder = {
        setLock: vi.fn().mockReturnThis(),
        where: vi.fn().mockReturnThis(),
        andWhere: vi.fn().mockReturnThis(),
        leftJoinAndSelect: vi.fn().mockReturnThis(),
        getOne: vi.fn().mockResolvedValue(mockCart),
        getMany: vi
          .fn()
          .mockResolvedValueOnce(mockCart.items)
          .mockResolvedValueOnce([mockProduct]),
      }
      queryRunnerMock.manager.createQueryBuilder.mockReturnValue(
        mockQueryBuilder,
      )

      userRepositoryMock.getByStripeId.mockResolvedValue({ id: userId })
      orderRepositoryMock.hasPendingOrder.mockResolvedValue(false)

      inventoryServiceMock.checkAvailability.mockRejectedValue(
        new Error('Product P1 is out of stock'),
      )

      await expect(
        checkoutService.processPayment(payload, userStripeId),
      ).rejects.toThrow('Product P1 is out of stock')

      expect(queryRunnerMock.rollbackTransaction).toHaveBeenCalled()
    })

    it('should throw error if cart is not active', async () => {
      const mockCart = {
        id: 1,
        status: 'completed', // Not active
        items: [],
      }

      const mockQueryBuilder = {
        setLock: vi.fn().mockReturnThis(),
        where: vi.fn().mockReturnThis(),
        andWhere: vi.fn().mockReturnThis(),
        leftJoinAndSelect: vi.fn().mockReturnThis(),
        getOne: vi.fn().mockResolvedValue(mockCart),
        getMany: vi.fn().mockResolvedValue([]),
      }
      queryRunnerMock.manager.createQueryBuilder.mockReturnValue(
        mockQueryBuilder,
      )

      userRepositoryMock.getByStripeId.mockResolvedValue({ id: userId })
      orderRepositoryMock.hasPendingOrder.mockResolvedValue(false)

      await expect(
        checkoutService.processPayment(payload, userStripeId),
      ).rejects.toThrow('Cart not active or not found')

      expect(queryRunnerMock.rollbackTransaction).toHaveBeenCalled()
    })

    it('should throw error if cart is empty', async () => {
      const mockCart = {
        id: 1,
        status: 'active',
        items: [],
      }

      const mockQueryBuilder = {
        setLock: vi.fn().mockReturnThis(),
        where: vi.fn().mockReturnThis(),
        andWhere: vi.fn().mockReturnThis(),
        leftJoinAndSelect: vi.fn().mockReturnThis(),
        getOne: vi.fn().mockResolvedValue(mockCart),
        getMany: vi.fn().mockResolvedValue([]),
      }
      queryRunnerMock.manager.createQueryBuilder.mockReturnValue(
        mockQueryBuilder,
      )

      userRepositoryMock.getByStripeId.mockResolvedValue({ id: userId })
      orderRepositoryMock.hasPendingOrder.mockResolvedValue(false)

      paymentGatewayProviderMock.processPayment.mockResolvedValue({
        confirmation_secret: {
          client_secret: 'client_secret',
        },
        id: 'in-001',
        lines: { data: [] },
      })

      await expect(
        checkoutService.processPayment(payload, userStripeId),
      ).rejects.toThrow('Cart is empty')

      expect(queryRunnerMock.rollbackTransaction).toHaveBeenCalled()
    })
  })
})
