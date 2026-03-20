import { ProductMetric, ProductQueryParams } from '#types'

import { Product } from '#entities'

import { BaseRepository } from '../base'

export abstract class AbstractProductRepository extends BaseRepository<Product> {
  abstract getById(id: string): Promise<Product | null>
  abstract getProducts(
    params: Omit<ProductQueryParams, 'page'> & { skip: number },
  ): Promise<[Product[], number]>

  abstract getAdminMetrics(): Promise<ProductMetric | undefined>
}
