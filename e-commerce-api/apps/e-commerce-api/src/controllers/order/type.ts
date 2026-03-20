import { FastifyReply, FastifyRequest } from 'fastify'

export interface IOrderController {
  getOrders(request: FastifyRequest, reply: FastifyReply): Promise<void>
  cancelOrder(request: FastifyRequest, reply: FastifyReply): Promise<void>
  getOrderById(request: FastifyRequest, reply: FastifyReply): Promise<void>
}
