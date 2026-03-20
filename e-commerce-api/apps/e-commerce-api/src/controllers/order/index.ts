import { FastifyReply, FastifyRequest } from 'fastify'
import { FromSchema } from 'json-schema-to-ts'

import dayjs from 'dayjs'

import { IOrderService } from '#services/types'

import { formatOrderDto } from '#dtos/order'

import { getOrdersSchema } from '#schemas/order'

import { OrderStatus } from '#entities'

import { BaseController } from '../base'
import { IOrderController } from './type'

export class OrderController
  extends BaseController
  implements IOrderController
{
  constructor(private service: IOrderService) {
    super()
  }

  getOrders = async (
    request: FastifyRequest<{
      Querystring: FromSchema<typeof getOrdersSchema>
    }>,
    reply: FastifyReply,
  ): Promise<void> => {
    const page = request.query.page
    const pageSize = request.query.pageSize
    const userId = request.auth.userId
    const status = request.query.status
    const user = request.auth.user

    const response = await this.service.getOrdersByUserId(userId, {
      page,
      pageSize,
      ...(status && { status: status as OrderStatus }),
      ...(request.query.date && { date: dayjs(request.query.date) }),
    })

    if (response.meta?.pagination) {
      this.sendPaginated(
        reply,
        response.data.map((order) => formatOrderDto(order, user)),
        response.meta.pagination,
      )
    } else {
      this.sendSuccess(
        reply,
        response.data.map((order) => formatOrderDto(order, user)),
        response.meta,
      )
    }
  }

  cancelOrder = async (
    request: FastifyRequest<{
      Params: { id: number }
    }>,
    reply: FastifyReply,
  ): Promise<void> => {
    const orderId = request.params.id
    const userId = request.auth.userId

    await this.service.cancelOrder({ orderId, userId })

    this.sendItem(reply, { success: true })
  }

  getOrderById = async (
    request: FastifyRequest<{
      Params: { id: number }
    }>,
    reply: FastifyReply,
  ): Promise<void> => {
    const orderId = request.params.id

    const order = await this.service.getOrderById(orderId)

    this.sendItem(reply, formatOrderDto(order, request.auth.user))
  }
}
