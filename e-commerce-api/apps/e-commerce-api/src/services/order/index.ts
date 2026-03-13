import { FastifyBaseLogger } from 'fastify'
import { QueryRunner } from 'typeorm'

import type { TOrderRepository } from '#repositories'

import {
  BadRequestError,
  NotFoundError,
  OrderQueryParams,
  Pagination,
  StockReservationStatus,
} from '#types'

import { Order, Product, StockReservation } from '#entities'

import { IOrderService } from './type'

export class OrderService implements IOrderService {
  constructor(
    private orderRepository: TOrderRepository,
    private logger: FastifyBaseLogger,
  ) {}

  async getOrdersByUserId(
    userId: string,
    params: OrderQueryParams,
  ): Promise<{ data: Order[]; meta: { pagination: Pagination } }> {
    this.logger.info(
      { userId, page: params.page, pageSize: params.pageSize },
      'Fetching orders for user',
    )
    const [count, orders] = await this.orderRepository.findOrdersByUserId(
      userId,
      params,
    )
    const result = {
      data: orders,
      meta: {
        pagination: {
          totalItems: count,
          itemsPerPage: params.pageSize,
          currentPage: params.page,
          totalPages: Math.ceil(count / params.pageSize),
          itemCount: orders.length,
        },
      },
    }

    this.logger.info(
      { userId, count, returnedCount: orders.length },
      'Orders fetched for user',
    )
    return result
  }

  async getOrders(
    params: OrderQueryParams,
  ): Promise<{ data: Order[]; meta: { pagination: Pagination } }> {
    this.logger.info(
      { page: params.page, pageSize: params.pageSize },
      'Fetching all orders (admin)',
    )
    const [count, orders] = await this.orderRepository.findOrders(params)
    const result = {
      data: orders,
      meta: {
        pagination: {
          totalItems: count,
          itemsPerPage: params.pageSize,
          currentPage: params.page,
          totalPages: Math.ceil(count / params.pageSize),
          itemCount: orders.length,
        },
      },
    }

    this.logger.info(
      { count, returnedCount: orders.length },
      'All orders fetched',
    )
    return result
  }

  async updateOrderStatus(
    params: { orderId: number; userId: string },
    status: Order['status'],
    queryRunner?: QueryRunner,
  ): Promise<Order> {
    const { orderId, userId } = params
    this.logger.info({ orderId, status }, 'Updating order status')

    const order = await this.orderRepository.findOne({
      where: { id: orderId, ...(userId && { user: { id: userId } }) },
      relations: { items: { product: true }, user: true },
    })

    if (!order) {
      this.logger.error({ orderId }, 'Order not found for status update')
      throw new NotFoundError('Order not found')
    }

    if (status === 'cancelled' && order.status !== 'pending') {
      this.logger.error({ orderId, status }, 'Order cannot be cancelled')
      throw new BadRequestError('Order cannot be cancelled')
    }

    order.status = status
    if (queryRunner) {
      await queryRunner.manager.save(order)
    } else {
      await this.orderRepository.save(order)
    }

    this.logger.info({ orderId, status }, 'Order status updated successfully')
    return order
  }

  async cancelOrder(params: {
    orderId: number
    userId: string
  }): Promise<Order> {
    const { orderId, userId } = params
    this.logger.info({ orderId, userId }, 'Cancelling order')

    const queryRunner =
      this.orderRepository.manager.connection.createQueryRunner()
    await queryRunner.connect()
    await queryRunner.startTransaction()

    try {
      const order = await this.updateOrderStatus(
        { orderId, userId },
        'cancelled',
        queryRunner,
      )

      const reservation = await queryRunner.manager.findOne(StockReservation, {
        where: { invoiceId: order.invoiceId },
        lock: { mode: 'pessimistic_write' },
      })

      if (reservation) {
        await queryRunner.manager.update(StockReservation, reservation.id, {
          status: StockReservationStatus.RELEASED,
        })

        if (order.items) {
          const quantityByProductId = {} as Record<string, number>

          const productIds = order.items.map(({ product, quantity }) => {
            quantityByProductId[product.id] = quantity
            return product.id
          })

          const products = await queryRunner.manager
            .createQueryBuilder(Product, 'product')
            .setLock('pessimistic_write')
            .where('id IN (:...productIds)', { productIds })
            .getMany()

          await Promise.all(
            products.map((product) => {
              queryRunner.manager.update(Product, product.id, {
                reservedStock:
                  product.reservedStock -
                  (quantityByProductId[product.id] || 0),
              })
            }),
          )
        }
      }

      this.logger.info({ orderId }, 'Order cancelled successfully')

      await queryRunner.commitTransaction()

      return order
    } catch (error) {
      await queryRunner.rollbackTransaction()
      throw error
    } finally {
      await queryRunner.release()
    }
  }

  async getOrderById(orderId: number): Promise<Order> {
    this.logger.info({ orderId }, 'Fetching order by ID')

    const order = await this.orderRepository.findOne({
      where: { id: orderId },
      relations: { items: { product: true }, user: true },
    })

    if (!order) {
      this.logger.error({ orderId }, 'Order not found')
      throw new NotFoundError('Order not found')
    }

    this.logger.info({ orderId }, 'Order fetched successfully')
    return order
  }
}
