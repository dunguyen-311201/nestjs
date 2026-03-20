import { FastifyReply, FastifyRequest } from 'fastify'

export interface IUserController {
  getProfile(request: FastifyRequest, reply: FastifyReply): Promise<void>
  updateRole(request: FastifyRequest, reply: FastifyReply): Promise<void>
}
