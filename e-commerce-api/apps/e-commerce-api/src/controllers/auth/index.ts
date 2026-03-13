import type { FastifyReply, FastifyRequest } from 'fastify'
import type { FromSchema } from 'json-schema-to-ts'

import type { IAuthService } from '#services/types'

import { isClerkAPIResponseError } from '#utils/clerk'

import { BadRequestError } from '#types'

import { transformatFromClerk } from '#dtos/user'

import { loginBodySchema, registerBodySchema } from '#schemas/auth'

import { BaseController } from '../base'
import { IAuthController } from './type'

export class AuthController extends BaseController implements IAuthController {
  constructor(private service: IAuthService) {
    super()
  }

  register = async (
    request: FastifyRequest<{
      Body: FromSchema<typeof registerBodySchema>
    }>,
    reply: FastifyReply,
  ): Promise<void> => {
    try {
      const newUser = transformatFromClerk(request.body)
      request.log.info(newUser, 'New User')
      const user = await this.service.register(newUser)
      request.log.info(user, 'User Registered')

      this.sendCreatedItem(reply, user)
    } catch (error) {
      if (isClerkAPIResponseError(error)) {
        throw new BadRequestError(error.errors[0].message)
      }

      throw error
    }
  }

  login = async (
    request: FastifyRequest<{
      Body: FromSchema<typeof loginBodySchema>
    }>,
    reply: FastifyReply,
  ): Promise<void> => {
    try {
      const { identifier, password } = request.body
      request.log.info({ identifier }, 'Login attempt')
      const result = await this.service.login(identifier, password)
      request.log.info(result, 'User logged in successfully')
      reply.send(result)
    } catch (error) {
      if (isClerkAPIResponseError(error)) {
        throw new BadRequestError('Invalid credentials')
      }
      throw error
    }
  }
}
