import { FastifyReply, FastifyRequest } from 'fastify'
import { FromSchema } from 'json-schema-to-ts'

import { IProductService } from '#services/types'

import { productToObject } from '#dtos/product'

import {
  ProductQuerySchema,
  addProductSchema,
  updateProductSchema,
} from '#schemas/product'

import { ProductStatus } from '#entities'

import { BaseController } from '../base'
import { IProductController } from './type'

export class ProductController
  extends BaseController
  implements IProductController
{
  constructor(private service: IProductService) {
    super()
  }

  updateProduct = async (
    request: FastifyRequest<{
      Params: { id: string }
      Body: FromSchema<typeof updateProductSchema>
    }>,
    reply: FastifyReply,
  ): Promise<void> => {
    const { id } = request.params
    const body = request.body

    const product = await this.service.updateProduct(id, body)

    this.sendItem(reply, productToObject(product))
  }

  addNewProduct = async (
    request: FastifyRequest<{ Body: FromSchema<typeof addProductSchema> }>,
    reply: FastifyReply,
  ): Promise<void> => {
    const productData = request.body
    const newProduct = await this.service.saveProduct(productData)
    this.sendCreatedItem(reply, productToObject(newProduct))
  }

  getProducts = async (
    request: FastifyRequest<{
      Querystring: FromSchema<typeof ProductQuerySchema>
    }>,
    reply: FastifyReply,
  ): Promise<void> => {
    const { page, pageSize, query, category, status, orderBy, order } =
      request.query
    const { data, meta } = await this.service.getProducts({
      page,
      pageSize,
      query,
      categories: category?.split(',') || [],
      status: status as ProductStatus | 'all',
      orderBy,
      order,
    })

    if (meta?.pagination) {
      this.sendPaginated(reply, data.map(productToObject), meta.pagination)
    } else {
      this.sendSuccess(reply, data.map(productToObject), meta)
    }
  }

  getProduct = async (
    request: FastifyRequest<{ Params: { id: string } }>,
    reply: FastifyReply,
  ): Promise<void> => {
    const { id } = request.params

    const product = await this.service.getProductById(id)

    if (!product) {
      this.sendNotFound(reply, 'Product not found')
      return
    }

    this.sendItem(reply, productToObject(product))
  }

  deleteProduct = async (
    request: FastifyRequest<{ Params: { id: string } }>,
    reply: FastifyReply,
  ): Promise<void> => {
    const id = request.params.id
    await this.service.deleteProduct(id)
    this.sendNoContent(reply)
  }
}
