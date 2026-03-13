import { Product } from '#entities'

import { MetadataParam } from './common'
import { Price } from './price'
import { Pagination } from './query'

export interface ProductCreateParams {
  name: string
  active?: boolean
  default_price_data?: DefaultPriceData
  description?: string
  id?: string
  images?: Array<string>
  url?: string
  metadata?: MetadataParam
}

interface DefaultPriceData {
  currency: string
  unit_amount?: number
}

export interface IProduct {
  id: string
  object: 'product'
  active: boolean
  created: number
  default_price: Price

  description: string | null
  images: Array<string>
  name: string
  updated: number
  url: string | null
  metadata?: MetadataParam
}

export type PartialProduct = Partial<
  Pick<
    Product,
    'category' | 'description' | 'images' | 'name' | 'price' | 'stock'
  >
>

export type ProductsResponse = {
  data: Product[]
  meta: { pagination: Pagination }
}
