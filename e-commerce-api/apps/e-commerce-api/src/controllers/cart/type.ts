import { FastifyReply, FastifyRequest } from 'fastify'

export interface ICartController {
  addProductToCart(request: FastifyRequest, reply: FastifyReply): Promise<void>
  removeProductFromCart(
    request: FastifyRequest,
    reply: FastifyReply,
  ): Promise<void>
  getCart(request: FastifyRequest, reply: FastifyReply): Promise<void>
  deleteCartItem(request: FastifyRequest, reply: FastifyReply): Promise<void>
  updateCartItemQuantity(
    request: FastifyRequest,
    reply: FastifyReply,
  ): Promise<void>
}
