import { FastifyReply, FastifyRequest } from 'fastify'
import { FromSchema } from 'json-schema-to-ts'

import dayjs from 'dayjs'

import { IOrderService } from '#services/types'

import { BaseController } from '#controllers/base'

import { formatOrderDto } from '#dtos/order'

import { updateOrderStatusSchema } from '#schemas/admin-order'
import { getOrdersSchema } from '#schemas/order'

import { OrderStatus } from '#entities'

import { IAdminOrderController } from './type'

export class AdminOrderController
  extends BaseController
  implements IAdminOrderController
{
  constructor(private service: IOrderService) {
    super()
  }

  getAllOrders = async (
    request: FastifyRequest<{
      Querystring: FromSchema<typeof getOrdersSchema>
    }>,
    reply: FastifyReply,
  ): Promise<void> => {
    const page = request.query.page
    const pageSize = request.query.pageSize
    const status = request.query.status
    const date = request.query.date

    const response = await this.service.getOrders({
      page,
      pageSize,
      status: status as OrderStatus,
      date: date ? dayjs(date) : undefined,
    })

    if (response.meta?.pagination) {
      this.sendPaginated(
        reply,
        response.data.map((order) => formatOrderDto(order)),
        response.meta.pagination,
      )
    } else {
      this.sendSuccess(
        reply,
        response.data.map((order) => formatOrderDto(order)),
        response.meta,
      )
    }
  }

  updateOrderStatus = async (
    request: FastifyRequest<{
      Params: { id: string }
      Body: FromSchema<typeof updateOrderStatusSchema>
    }>,
    reply: FastifyReply,
  ): Promise<void> => {
    const orderId = parseInt(request.params.id)
    const { status } = request.body

    const order = await this.service.updateOrderStatus({ orderId }, status)

    if (order) {
      this.sendItem(reply, formatOrderDto(order))
    } else {
      this.sendNotFound(reply, 'Order not found')
    }
  }
}
