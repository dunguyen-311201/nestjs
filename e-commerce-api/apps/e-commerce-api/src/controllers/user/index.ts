import { FastifyReply, FastifyRequest } from 'fastify'
import { FromSchema } from 'json-schema-to-ts'

import { IUserService } from '#services/types'

import { USER_ROLES, USER_ROLES_ARRAY } from '#types/user'

import { UpdateUserRoleSchema } from '#schemas/user'

import { BaseController } from '../base'
import { IUserController } from './type'

export class UserController extends BaseController implements IUserController {
  constructor(private service: IUserService) {
    super()
  }

  getProfile = async (
    request: FastifyRequest,
    reply: FastifyReply,
  ): Promise<void> => {
    const { userId } = request.auth
    const user = await this.service.getById(userId)
    request.log.info(user, 'Fetched User')
    this.sendItem(reply, user)
  }

  updateRole = async (
    request: FastifyRequest<{ Body: FromSchema<typeof UpdateUserRoleSchema> }>,
    reply: FastifyReply,
  ): Promise<void> => {
    const { data } = request.body
    const { role_name, public_user_data } = data
    const role = role_name.toLowerCase() as USER_ROLES
    if (!USER_ROLES_ARRAY.includes(role)) {
      throw new Error('Invalid role')
    }
    const user = await this.service.addRoleForUser(
      public_user_data.user_id,
      role,
    )
    request.log.info(user, 'Updated User Role')
    this.sendItem(reply, user)
  }
}
