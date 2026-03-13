import { FastifyPluginCallback } from 'fastify'

import { HttpStatus } from '#types/http-status'

import {
  UserErrorResponseSchema,
  UserProfileResponseSchema,
} from '#schemas/user'

export const userRoutes: FastifyPluginCallback = (instance, _, done) => {
  const { userController } = instance.container.controllers
  instance.get(
    '/me',
    {
      preHandler: [instance.authenticate],
      schema: {
        description: 'Get user profile',
        tags: ['user'],
        security: [{ bearerAuth: [] }],
        response: {
          [HttpStatus.OK]: UserProfileResponseSchema,
          [HttpStatus.INTERNAL_SERVER_ERROR]: UserErrorResponseSchema,
          [HttpStatus.TOO_MANY_REQUESTS]: UserErrorResponseSchema,
        },
      },
    },
    userController.getProfile,
  )

  instance.post(
    '/update-role',
    {
      schema: {
        description: 'Update user role',
        tags: ['user'],
        response: {
          [HttpStatus.OK]: UserProfileResponseSchema,
          [HttpStatus.INTERNAL_SERVER_ERROR]: UserErrorResponseSchema,
          [HttpStatus.TOO_MANY_REQUESTS]: UserErrorResponseSchema,
        },
      },
    },
    userController.updateRole,
  )
  done()
}
