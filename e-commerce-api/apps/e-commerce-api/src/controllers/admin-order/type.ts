import { FastifyReply, FastifyRequest } from 'fastify'

export interface IAdminOrderController {
  getAllOrders(request: FastifyRequest, reply: FastifyReply): Promise<void>
  updateOrderStatus(request: FastifyRequest, reply: FastifyReply): Promise<void>
}
