import { FastifyReply, FastifyRequest } from 'fastify'

export interface ICheckoutController {
  stripeWebhookHandler(
    request: FastifyRequest,
    reply: FastifyReply,
  ): Promise<void>
  createPaymentIntentHandler(
    request: FastifyRequest,
    reply: FastifyReply,
  ): Promise<void>
}
