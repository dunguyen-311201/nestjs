import { FastifyReply, FastifyRequest } from 'fastify'

export interface IMetricController {
  getProductMetrics(request: FastifyRequest, reply: FastifyReply): Promise<void>
}
