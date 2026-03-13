import { FastifyReply, FastifyRequest } from 'fastify'
import { beforeEach, describe, expect, it, vi } from 'vitest'

import { ICheckoutService } from '#services/types'

import { UnexpectedError } from '#types'

import { CheckoutController } from '../index'

// Mock dependencies
const mockCheckoutService = {
  processPayment: vi.fn(),
  handleSuccessfulPayment: vi.fn(),
}

describe('CheckoutController', () => {
  let checkoutController: CheckoutController
  let mockRequest: Partial<FastifyRequest> & {
    auth: { userId: string; stripeId: string }
    body: any
  }
  let mockReply: Partial<FastifyReply> & { send: any; status: any }

  beforeEach(() => {
    vi.clearAllMocks()

    checkoutController = new CheckoutController(
      mockCheckoutService as unknown as ICheckoutService,
    )

    mockRequest = {
      auth: { userId: 'user_123', stripeId: 'cus_123' },
      body: {},
    } as any

    mockReply = {
      send: vi.fn().mockReturnThis(),
      status: vi.fn().mockReturnThis(),
    }
  })

  describe('createPaymentIntentHandler', () => {
    it('should create payment intent successfully', async () => {
      mockRequest.body = { amount: 100, currency: 'usd' }
      const mockInvoice = {
        clientSecret: 'sec_123',
      }
      mockCheckoutService.processPayment.mockResolvedValue(mockInvoice)

      await checkoutController.createPaymentIntentHandler(
        mockRequest as FastifyRequest<any>,
        mockReply as FastifyReply,
      )

      expect(mockCheckoutService.processPayment).toHaveBeenCalledWith(
        { currency: 'usd' },
        'cus_123',
      )
      expect(mockReply.send).toHaveBeenCalledWith({ clientSecret: 'sec_123' })
    })

    it('should throw UnexpectedError if confirmation_secret is missing', async () => {
      mockRequest.body = { amount: 100, currency: 'usd' }
      mockCheckoutService.processPayment.mockResolvedValue({})

      await expect(
        checkoutController.createPaymentIntentHandler(
          mockRequest as FastifyRequest<any>,
          mockReply as FastifyReply,
        ),
      ).rejects.toThrow(UnexpectedError)
    })
  })

  describe('stripeWebhookHandler', () => {
    it('should handle invoice.payment_succeeded event', async () => {
      mockRequest.body = {
        type: 'invoice.payment_succeeded',
        data: {
          object: { id: 'inv_123', customer: 'cus_123' },
        },
      }

      await checkoutController.stripeWebhookHandler(
        mockRequest as FastifyRequest<any>,
        mockReply as FastifyReply,
      )

      expect(mockCheckoutService.handleSuccessfulPayment).toHaveBeenCalledWith(
        'cus_123',
        'inv_123',
      )
      expect(mockReply.send).toHaveBeenCalledWith({ received: true })
    })

    it('should ignore other events', async () => {
      mockRequest.body = {
        type: 'other.event',
        data: { object: {} },
      }

      await checkoutController.stripeWebhookHandler(
        mockRequest as FastifyRequest<any>,
        mockReply as FastifyReply,
      )

      expect(mockCheckoutService.handleSuccessfulPayment).not.toHaveBeenCalled()
      expect(mockReply.send).toHaveBeenCalledWith({ received: true })
    })
  })
})
