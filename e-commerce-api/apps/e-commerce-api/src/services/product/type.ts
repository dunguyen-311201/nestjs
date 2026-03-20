import { FromSchema } from 'json-schema-to-ts'

import { Pagination, ProductQueryParams } from '#types'

import { addProductSchema, updateProductSchema } from '#schemas/product'

import { Product } from '#entities'

type ProductsResponse = { data: Product[]; meta: { pagination: Pagination } }
export interface IProductService {
  getProducts(params: ProductQueryParams): Promise<ProductsResponse>
  getProductById(id: string): Promise<Product | null>
  saveProduct(product: FromSchema<typeof addProductSchema>): Promise<Product>
  updateProduct(
    id: string,
    product: FromSchema<typeof updateProductSchema>,
  ): Promise<Product>
  deleteProduct(id: string): Promise<void>
}
