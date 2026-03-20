import { FastifyBaseLogger } from 'fastify'

import type { TProductRepository } from '#repositories'

import { ProductMetric } from '#types'

import { IMetricService } from './type'

export class MetricService implements IMetricService {
  constructor(
    private productRepository: TProductRepository,
    private logger: FastifyBaseLogger,
  ) {}

  async getDashboardStats(): Promise<ProductMetric & { updatedAt: string }> {
    this.logger.info('Fetching dashboard stats')
    const rawData = await this.productRepository.getAdminMetrics()

    const stats = {
      totalProducts: Number(rawData?.totalProducts || 0),
      totalStock: Number(rawData?.totalStock || 0),
      totalValue: Number(rawData?.totalValue || 0),
      updatedAt: new Date().toISOString(),
    }

    this.logger.info(stats, 'Dashboard stats fetched successfully')
    return stats
  }
}
