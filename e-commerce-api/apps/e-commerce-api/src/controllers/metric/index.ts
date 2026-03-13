import { FastifyReply, FastifyRequest } from 'fastify'

import { IMetricService } from '#services/types'

import { BaseController } from '../base'
import { IMetricController } from './type'

export class MetricController
  extends BaseController
  implements IMetricController
{
  constructor(private metricService: IMetricService) {
    super()
  }

  getProductMetrics = async (_: FastifyRequest, reply: FastifyReply) => {
    const rawData = await this.metricService.getDashboardStats()
    this.sendItem(reply, rawData)
  }
}
