import { FastifyReply, FastifyRequest } from 'fastify'

export interface IProductController {
  getProducts(request: FastifyRequest, reply: FastifyReply): Promise<void>
  getProduct(request: FastifyRequest, reply: FastifyReply): Promise<void>
  addNewProduct(request: FastifyRequest, reply: FastifyReply): Promise<void>
  deleteProduct(request: FastifyRequest, reply: FastifyReply): Promise<void>
  updateProduct(request: FastifyRequest, reply: FastifyReply): Promise<void>
}
