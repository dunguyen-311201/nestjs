import { FastifyReply, FastifyRequest } from 'fastify'

export interface IAuthController {
  register(request: FastifyRequest, reply: FastifyReply): Promise<void>
  login(request: FastifyRequest, reply: FastifyReply): Promise<void>
}
