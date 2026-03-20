import { FastifyPluginCallback } from 'fastify'

import { HttpStatus } from '#types/http-status'

import {
  CategoryErrorResponseSchema,
  CategoryListResponseSchema,
  CategorySchema,
} from '#schemas/category'

export const categoryRoutes: FastifyPluginCallback = (instance, _, done) => {
  const { categoryController } = instance.container.controllers
  instance.get(
    '/',
    {
      schema: {
        description: 'Get all categories',
        tags: ['categories'],
        response: {
          [HttpStatus.OK]: CategoryListResponseSchema,
          [HttpStatus.INTERNAL_SERVER_ERROR]: CategoryErrorResponseSchema,
          [HttpStatus.TOO_MANY_REQUESTS]: CategoryErrorResponseSchema,
        },
      },
    },
    categoryController.getAll,
  )

  done()
}

export const categoryAdminRoutes: FastifyPluginCallback = (
  instance,
  _,
  done,
) => {
  instance.addHook('preHandler', instance.authenticate)
  instance.addHook('preHandler', instance.authorizeAdmin)

  const { categoryController } = instance.container.controllers

  instance.post(
    '/',
    {
      schema: {
        description: 'Create a new category - (Admin only)',
        tags: ['categories', 'admin'],
        security: [{ bearerAuth: [] }],
        body: {
          type: 'object',
          required: ['name'],
          properties: {
            name: {
              type: 'string',
              description: 'Category name',
            },
          },
        },
        response: {
          [HttpStatus.CREATED]: CategorySchema,
          [HttpStatus.BAD_REQUEST]: CategoryErrorResponseSchema,
          [HttpStatus.UNAUTHORIZED]: CategoryErrorResponseSchema,
          [HttpStatus.FORBIDDEN]: CategoryErrorResponseSchema,
          [HttpStatus.INTERNAL_SERVER_ERROR]: CategoryErrorResponseSchema,
        },
      },
    },
    categoryController.create,
  )

  done()
}
