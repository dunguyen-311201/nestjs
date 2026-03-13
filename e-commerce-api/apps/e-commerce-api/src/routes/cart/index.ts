import { FastifyPluginCallback } from 'fastify'

import { HttpStatus } from '#types/http-status'

import {
  CartItemSchema,
  CartItemUpdatedSchema,
  CartSchema,
} from '#schemas/cart'
import { ErrorResponseSchema } from '#schemas/response'

export const cartRoutes: FastifyPluginCallback = (instance, _, done) => {
  const { cartController } = instance.container.controllers

  instance.post(
    '/add-item',
    {
      preHandler: [instance.authenticate],
      schema: {
        description: 'Add product to cart (create/update cart item)',
        tags: ['cart'],
        security: [{ bearerAuth: [] }],
        body: {
          type: 'object',
          required: ['productId', 'quantity'],
          properties: {
            productId: { type: 'string' },
            quantity: { type: 'number', minimum: 0 },
          },
          examples: [
            { productId: 'prod_123', quantity: 2 },
            { productId: 'prod_123', quantity: 0 },
          ],
        },
        response: {
          [HttpStatus.CREATED]: CartItemSchema,
          [HttpStatus.BAD_REQUEST]: ErrorResponseSchema,
          [HttpStatus.UNAUTHORIZED]: ErrorResponseSchema,
          [HttpStatus.NOT_FOUND]: ErrorResponseSchema,
          [HttpStatus.INTERNAL_SERVER_ERROR]: ErrorResponseSchema,
          [HttpStatus.TOO_MANY_REQUESTS]: ErrorResponseSchema,
        },
      },
    },
    cartController.addProductToCart,
  )
  instance.get(
    '/',
    {
      preHandler: [instance.authenticate],
      schema: {
        description: "Get current user's cart",
        tags: ['cart'],
        security: [{ bearerAuth: [] }],
        response: {
          [HttpStatus.OK]: CartSchema,
          [HttpStatus.UNAUTHORIZED]: ErrorResponseSchema,
          [HttpStatus.TOO_MANY_REQUESTS]: ErrorResponseSchema,
          [HttpStatus.INTERNAL_SERVER_ERROR]: ErrorResponseSchema,
        },
      },
    },
    cartController.getCart,
  )
  instance.delete(
    '/items/:id',
    {
      preHandler: [instance.authenticate],
      schema: {
        description: 'Delete a cart item',
        tags: ['cart'],
        security: [{ bearerAuth: [] }],
        params: {
          type: 'object',
          required: ['id'],
          properties: {
            id: {
              type: 'string',
              description: 'Cart item id (number as string)',
            },
          },
        },
        response: {
          [HttpStatus.NO_CONTENT]: { type: 'null' },
          [HttpStatus.UNAUTHORIZED]: ErrorResponseSchema,
          [HttpStatus.NOT_FOUND]: ErrorResponseSchema,
          [HttpStatus.INTERNAL_SERVER_ERROR]: ErrorResponseSchema,
          [HttpStatus.TOO_MANY_REQUESTS]: ErrorResponseSchema,
        },
      },
    },
    cartController.deleteCartItem,
  )
  instance.put(
    '/items/:id',
    {
      preHandler: [instance.authenticate],
      schema: {
        description: 'Update cart item quantity',
        tags: ['cart'],
        security: [{ bearerAuth: [] }],
        params: {
          type: 'object',
          required: ['id'],
          properties: {
            id: {
              type: 'string',
              description: 'Cart item id (number as string)',
            },
          },
        },
        body: {
          type: 'object',
          required: ['quantity'],
          properties: {
            quantity: { type: 'string', description: 'Quantity as string' },
          },
          examples: [{ quantity: '3' }],
        },
        response: {
          [HttpStatus.OK]: CartItemUpdatedSchema,
          [HttpStatus.UNAUTHORIZED]: ErrorResponseSchema,
          [HttpStatus.NOT_FOUND]: ErrorResponseSchema,
          [HttpStatus.INTERNAL_SERVER_ERROR]: ErrorResponseSchema,
          [HttpStatus.TOO_MANY_REQUESTS]: ErrorResponseSchema,
        },
      },
    },
    cartController.updateCartItemQuantity,
  )
  done()
}
