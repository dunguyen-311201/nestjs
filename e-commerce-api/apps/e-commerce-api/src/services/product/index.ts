import { FastifyBaseLogger } from 'fastify'
import { FromSchema } from 'json-schema-to-ts'

import type { TCategoryRepository, TProductRepository } from '#repositories'

import {
  BadRequestError,
  NotFoundError,
  Pagination,
  PaymentGateway,
  ProductQueryParams,
} from '#types'

import { addProductSchema, updateProductSchema } from '#schemas/product'

import { Product } from '#entities'

import { IProductService } from './type'

export class ProductService implements IProductService {
  constructor(
    private productRepository: TProductRepository,
    private categoryRepository: TCategoryRepository,
    private paymentGatewayProvider: PaymentGateway,
    private logger: FastifyBaseLogger,
  ) {}

  async getProducts(
    params: ProductQueryParams,
  ): Promise<{ data: Product[]; meta: { pagination: Pagination } }> {
    const { query, page, pageSize, categories, status, orderBy, order } = params
    this.logger.info(
      { query, page, pageSize, categories, status },
      'Fetching products',
    )
    const skip = (page - 1) * pageSize

    const [products, totalCount] = await this.productRepository.getProducts({
      pageSize,
      query,
      skip,
      categories,
      status,
      orderBy,
      order,
    })

    const result = {
      data: products,
      meta: {
        pagination: {
          totalItems: totalCount,
          itemCount: products.length,
          itemsPerPage: pageSize,
          totalPages: Math.ceil(totalCount / pageSize),
          currentPage: Math.floor(skip / pageSize) + 1,
        },
      },
    }

    this.logger.info(
      { totalCount, returnedCount: products.length, page },
      'Products fetched successfully',
    )
    return result
  }

  async getProductById(id: string): Promise<Product | null> {
    this.logger.debug({ productId: id }, 'Fetching product by ID')
    const product = await this.productRepository.getById(id)

    if (product) {
      this.logger.debug({ productId: id }, 'Product found')
    } else {
      this.logger.debug({ productId: id }, 'Product not found')
    }
    return product
  }

  async saveProduct(
    payload: FromSchema<typeof addProductSchema>,
  ): Promise<Product> {
    this.logger.info(
      { name: payload.name, price: payload.price },
      'Creating new product',
    )

    const { price, name, images, description, category: categoryName } = payload

    const category = await this.categoryRepository.findOneBy({
      name: categoryName,
    })

    if (!category) {
      throw new BadRequestError(`Not found Category by name: ${categoryName}`)
    }

    const newProduct = await this.paymentGatewayProvider.createProduct({
      name,
      description,
      images,
      active: true,
      default_price_data: {
        currency: 'usd',
        unit_amount: Math.round(price * 100),
      },
    })

    this.logger.debug(
      { productId: newProduct.id, name },
      'Stripe product created',
    )

    const product = await this.productRepository.save({
      ...payload,
      id: newProduct.id,
      category,
    })
    this.logger.info(
      { productId: product.id, name: product.name },
      'Product created successfully',
    )
    return { ...product, category }
  }

  async updateProduct(
    id: string,
    body: FromSchema<typeof updateProductSchema>,
  ): Promise<Product> {
    this.logger.info(
      { productId: id, updates: Object.keys(body) },
      'Updating product',
    )

    const product = await this.getProductById(id)

    if (!product) {
      this.logger.error({ productId: id }, 'Product not found for update')
      throw new NotFoundError(`Not found Product by ID: ${id}`)
    }

    if (body.stock !== undefined && body.stock < (product.reservedStock || 0)) {
      throw new BadRequestError(
        `Stock cannot be less than reserved stock (${product.reservedStock})`,
      )
    }

    const updated = await this.productRepository.save({
      ...product,
      ...body,
      category: { name: body.category },
    })

    this.logger.info({ productId: id }, 'Product updated successfully')
    return updated
  }

  async deleteProduct(id: string): Promise<void> {
    this.logger.info({ productId: id }, 'Deleting product (soft delete)')
    await this.productRepository.softDeleteById(id)
    this.logger.info({ productId: id }, 'Product deleted successfully')
  }
}
