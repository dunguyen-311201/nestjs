import { ProductMetric } from '#types'

export interface IMetricService {
  getDashboardStats(): Promise<ProductMetric & { updatedAt: string }>
}
