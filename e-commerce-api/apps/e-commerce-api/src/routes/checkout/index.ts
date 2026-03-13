import fastifyRateLimit from '@fastify/rate-limit'
import { FastifyPluginCallback } from 'fastify'

import {
  CheckoutErrorResponseSchema,
  PaymentIntentResponseSchema,
  StripeWebhookAckSchema,
  createPaymentIntentSchema,
  paymentSuccessSchema,
} from '#schemas'

import { HttpStatus } from '#types/http-status'

import { validateRequest } from '#middlewares'

export const checkoutRoutes: FastifyPluginCallback = (
  instance,
  _opts,
  done,
) => {
  instance.register(fastifyRateLimit, { max: 3, timeWindow: '1 minute' })

  const container = instance.container.controllers.checkoutController
  instance.post(
    '/',
    {
      schema: {
        description: 'Create Stripe payment intent',
        tags: ['checkout'],
        security: [{ bearerAuth: [] }],
        body: createPaymentIntentSchema,
        response: {
          [HttpStatus.OK]: PaymentIntentResponseSchema,
          [HttpStatus.BAD_REQUEST]: CheckoutErrorResponseSchema,
          [HttpStatus.UNAUTHORIZED]: CheckoutErrorResponseSchema,
          [HttpStatus.INTERNAL_SERVER_ERROR]: CheckoutErrorResponseSchema,
        },
      },
      preHandler: [instance.authenticate],
    },
    container.createPaymentIntentHandler,
  )

  instance.post(
    '/stripe-webhooks',
    {
      preHandler: [validateRequest],
      schema: {
        description: 'Stripe webhook (invoice.payment_succeeded)',
        tags: ['checkout'],
        body: paymentSuccessSchema,
        response: {
          [HttpStatus.OK]: StripeWebhookAckSchema,
          [HttpStatus.BAD_REQUEST]: CheckoutErrorResponseSchema,
          [HttpStatus.INTERNAL_SERVER_ERROR]: CheckoutErrorResponseSchema,
          [HttpStatus.TOO_MANY_REQUESTS]: CheckoutErrorResponseSchema,
        },
      },
    },
    container.stripeWebhookHandler,
  )
  done()
}
