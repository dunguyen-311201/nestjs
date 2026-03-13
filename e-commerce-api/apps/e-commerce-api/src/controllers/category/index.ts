import { FastifyReply, FastifyRequest } from 'fastify'

import { ICategoryService } from '#services/types'

import { BaseController } from '../base'
import { ICategoryController } from './type'

export class CategoryController
  extends BaseController
  implements ICategoryController
{
  constructor(private service: ICategoryService) {
    super()
  }

  getAll = async (_: FastifyRequest, reply: FastifyReply): Promise<void> => {
    const categories = await this.service.getAll()
    this.sendSuccess(reply, categories)
  }

  create = async (
    request: FastifyRequest,
    reply: FastifyReply,
  ): Promise<void> => {
    const categoryData = request.body as { name: string }
    const category = await this.service.create(categoryData)
    this.sendCreatedItem(reply, category)
  }
}
