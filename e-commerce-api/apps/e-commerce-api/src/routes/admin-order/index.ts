import { FastifyPluginCallback } from 'fastify'

import {
  ErrorResponseSchema,
  OrderSchema,
  OrdersPaginatedResponseSchema,
  getOrdersSchema,
  updateOrderStatusSchema,
} from '#schemas'

import { HttpStatus } from '#types/http-status'

export const adminOrderRoutes: FastifyPluginCallback = (instance, _, done) => {
  const controller = instance.container.controllers.adminOrderController

  instance.get(
    '/',
    {
      preHandler: [instance.authenticate, instance.authorizeAdmin],
      schema: {
        description: 'Admin: get all orders',
        tags: ['admin', 'orders'],
        security: [{ bearerAuth: [] }],
        querystring: getOrdersSchema,
        response: {
          [HttpStatus.OK]: OrdersPaginatedResponseSchema,
          [HttpStatus.UNAUTHORIZED]: ErrorResponseSchema,
          [HttpStatus.FORBIDDEN]: ErrorResponseSchema,
          [HttpStatus.INTERNAL_SERVER_ERROR]: ErrorResponseSchema,
          [HttpStatus.TOO_MANY_REQUESTS]: ErrorResponseSchema,
        },
      },
    },
    controller.getAllOrders,
  )

  instance.patch(
    '/:id/status',
    {
      preHandler: [instance.authenticate, instance.authorizeAdmin],
      schema: {
        description: 'Admin: update order status',
        tags: ['admin', 'orders'],
        security: [{ bearerAuth: [] }],
        params: {
          type: 'object',
          required: ['id'],
          properties: {
            id: { type: 'string', description: 'Order id (number as string)' },
          },
        },
        body: updateOrderStatusSchema,
        response: {
          [HttpStatus.OK]: OrderSchema,
          [HttpStatus.BAD_REQUEST]: ErrorResponseSchema,
          [HttpStatus.UNAUTHORIZED]: ErrorResponseSchema,
          [HttpStatus.FORBIDDEN]: ErrorResponseSchema,
          [HttpStatus.NOT_FOUND]: ErrorResponseSchema,
          [HttpStatus.INTERNAL_SERVER_ERROR]: ErrorResponseSchema,
          [HttpStatus.TOO_MANY_REQUESTS]: ErrorResponseSchema,
        },
      },
    },
    controller.updateOrderStatus,
  )

  done()
}
