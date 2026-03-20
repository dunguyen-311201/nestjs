import { FastifyPluginCallback } from 'fastify'

import { HttpStatus } from '#types/http-status'

import {
  ProductDetailResponseSchema,
  ProductErrorResponseSchema,
  ProductListResponseSchema,
  ProductQuerySchema,
} from '#schemas/product'

export const productRoutes: FastifyPluginCallback = (instance, _, done) => {
  const { productController } = instance.container.controllers
  instance.get(
    '/',
    {
      schema: {
        description: 'Get paginated list of products',
        tags: ['products'],
        querystring: ProductQuerySchema,
        response: {
          [HttpStatus.OK]: ProductListResponseSchema,
          [HttpStatus.BAD_REQUEST]: ProductErrorResponseSchema,
          [HttpStatus.TOO_MANY_REQUESTS]: ProductErrorResponseSchema,
          [HttpStatus.INTERNAL_SERVER_ERROR]: ProductErrorResponseSchema,
        },
      },
    },
    productController.getProducts,
  )
  instance.get(
    '/:id',
    {
      schema: {
        description: 'Get a single product by ID',
        tags: ['products'],
        params: {
          type: 'object',
          properties: {
            id: {
              type: 'string',
              description: 'Product ID',
            },
          },
          required: ['id'],
        },
        response: {
          [HttpStatus.OK]: ProductDetailResponseSchema,
          [HttpStatus.NOT_FOUND]: ProductErrorResponseSchema,
          [HttpStatus.INTERNAL_SERVER_ERROR]: ProductErrorResponseSchema,
        },
      },
    },
    productController.getProduct,
  )

  done()
}

export const productAdminRoutes: FastifyPluginCallback = (
  instance,
  _,
  done,
) => {
  instance.addHook('preHandler', instance.authenticate)
  instance.addHook('preHandler', instance.authorizeAdmin)

  const { productController } = instance.container.controllers

  instance.post(
    '/',
    {
      preHandler: [instance.authenticate, instance.authorizeAdmin],
      schema: {
        description: 'Create a new product (Admin only)',
        tags: ['products', 'admin'],
        security: [{ bearerAuth: [] }],
        body: {
          type: 'object',
          required: ['name', 'description', 'price', 'stock', 'category'],
          properties: {
            name: {
              type: 'string',
              description: 'Product name',
            },
            description: {
              type: 'string',
              description: 'Product description',
            },
            price: {
              type: 'number',
              description: 'Product price',
            },
            stock: {
              type: 'integer',
              description: 'Stock quantity',
            },
            category: {
              type: 'string',
              description: 'Category name',
            },
            images: {
              type: 'array',
              items: { type: 'string' },
              description: 'Product images URLs',
            },
            status: {
              type: 'string',
              enum: ['draft', 'published'],
              description: 'Product status',
              default: 'draft',
            },
          },
        },
        response: {
          [HttpStatus.CREATED]: ProductDetailResponseSchema,
          [HttpStatus.BAD_REQUEST]: ProductErrorResponseSchema,
          [HttpStatus.UNAUTHORIZED]: ProductErrorResponseSchema,
          [HttpStatus.FORBIDDEN]: ProductErrorResponseSchema,
          [HttpStatus.INTERNAL_SERVER_ERROR]: ProductErrorResponseSchema,
          [HttpStatus.TOO_MANY_REQUESTS]: ProductErrorResponseSchema,
        },
      },
    },
    productController.addNewProduct,
  )

  instance.put(
    '/:id',
    {
      preHandler: [instance.authenticate, instance.authorizeAdmin],
      schema: {
        description: 'Update a product (Admin only)',
        tags: ['products', 'admin'],
        security: [{ bearerAuth: [] }],
        params: {
          type: 'object',
          properties: {
            id: {
              type: 'string',
              description: 'Product ID',
            },
          },
          required: ['id'],
        },
        body: {
          type: 'object',
          properties: {
            name: { type: 'string' },
            description: { type: 'string' },
            price: { type: 'number' },
            stock: { type: 'integer' },
            category: { type: 'string' },
            images: {
              type: 'array',
              items: { type: 'string' },
            },
            status: {
              type: 'string',
              enum: ['draft', 'published', 'archived', 'deleted'],
            },
          },
        },
        response: {
          [HttpStatus.OK]: ProductDetailResponseSchema,
          [HttpStatus.BAD_REQUEST]: ProductErrorResponseSchema,
          [HttpStatus.UNAUTHORIZED]: ProductErrorResponseSchema,
          [HttpStatus.FORBIDDEN]: ProductErrorResponseSchema,
          [HttpStatus.NOT_FOUND]: ProductErrorResponseSchema,
          [HttpStatus.INTERNAL_SERVER_ERROR]: ProductErrorResponseSchema,
          [HttpStatus.TOO_MANY_REQUESTS]: ProductErrorResponseSchema,
        },
      },
    },
    productController.updateProduct,
  )

  instance.delete(
    '/:id',
    {
      preHandler: [instance.authenticate, instance.authorizeAdmin],
      schema: {
        description: 'Delete a product (Admin only)',
        tags: ['products', 'admin'],
        security: [{ bearerAuth: [] }],
        params: {
          type: 'object',
          properties: {
            id: {
              type: 'string',
              description: 'Product ID',
            },
          },
          required: ['id'],
        },
        response: {
          [HttpStatus.NO_CONTENT]: {
            type: 'null',
            description: 'Product deleted successfully',
          },
          [HttpStatus.UNAUTHORIZED]: ProductErrorResponseSchema,
          [HttpStatus.FORBIDDEN]: ProductErrorResponseSchema,
          [HttpStatus.NOT_FOUND]: ProductErrorResponseSchema,
          [HttpStatus.INTERNAL_SERVER_ERROR]: ProductErrorResponseSchema,
          [HttpStatus.TOO_MANY_REQUESTS]: ProductErrorResponseSchema,
        },
      },
    },
    productController.deleteProduct,
  )

  done()
}
