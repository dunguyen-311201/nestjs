import { FastifyPluginCallback } from 'fastify'

import { HttpStatus } from '#types/http-status'

import {
  OrderErrorResponseSchema,
  OrderSchema,
  OrdersPaginatedResponseSchema,
  getOrdersSchema,
} from '#schemas/order'

export const orderRoutes: FastifyPluginCallback = (instance, _, done) => {
  const controller = instance.container.controllers.orderController

  instance.get(
    '/',
    {
      preHandler: [instance.authenticate],
      schema: {
        description: "Get current user's orders (paginated)",
        tags: ['orders'],
        security: [{ bearerAuth: [] }],
        querystring: getOrdersSchema,
        response: {
          [HttpStatus.OK]: OrdersPaginatedResponseSchema,
          [HttpStatus.UNAUTHORIZED]: OrderErrorResponseSchema,
          [HttpStatus.INTERNAL_SERVER_ERROR]: OrderErrorResponseSchema,
          [HttpStatus.TOO_MANY_REQUESTS]: OrderErrorResponseSchema,
        },
      },
    },
    controller.getOrders,
  )

  instance.patch(
    '/:id/cancel',
    {
      preHandler: [instance.authenticate],
      schema: {
        description: 'Cancel an order',
        tags: ['orders'],
        security: [{ bearerAuth: [] }],
        params: {
          type: 'object',
          properties: {
            id: { type: 'number' },
          },
          required: ['id'],
        },
        response: {
          [HttpStatus.OK]: {
            type: 'object',
            properties: {
              success: { type: 'boolean' },
            },
          },
          [HttpStatus.UNAUTHORIZED]: OrderErrorResponseSchema,
          [HttpStatus.INTERNAL_SERVER_ERROR]: OrderErrorResponseSchema,
          [HttpStatus.TOO_MANY_REQUESTS]: OrderErrorResponseSchema,
        },
      },
    },
    controller.cancelOrder,
  )

  instance.get(
    '/:id',
    {
      preHandler: [instance.authenticate],
      schema: {
        description: 'Get an order by ID',
        tags: ['orders'],
        security: [{ bearerAuth: [] }],
        params: {
          type: 'object',
          properties: {
            id: { type: 'number' },
          },
          required: ['id'],
        },
        response: {
          [HttpStatus.OK]: {
            type: 'object',
            properties: {
              ...OrderSchema.properties,
            },
          },
          [HttpStatus.UNAUTHORIZED]: OrderErrorResponseSchema,
          [HttpStatus.INTERNAL_SERVER_ERROR]: OrderErrorResponseSchema,
          [HttpStatus.TOO_MANY_REQUESTS]: OrderErrorResponseSchema,
        },
      },
    },
    controller.getOrderById,
  )

  done()
}
