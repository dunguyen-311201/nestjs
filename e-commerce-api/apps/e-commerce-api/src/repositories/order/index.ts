import { Between, QueryRunner } from 'typeorm'

import { OrderQueryParams } from '#types'

import { Order } from '#entities'

import { AbstractOrderRepository } from './type'

export class OrderRepository extends AbstractOrderRepository {
  async findPendingOrder(userId: string): Promise<Order | null> {
    return await this.findOne({
      where: { user: { id: userId }, status: 'pending' },
      relations: { items: { product: true } },
    })
  }

  async hasPendingOrder(userId: string): Promise<boolean> {
    const count = await this.count({
      where: { user: { id: userId }, status: 'pending' },
    })
    return count > 0
  }

  async findOrdersByUserId(
    userId: string,
    params: OrderQueryParams,
  ): Promise<[number, Order[]]> {
    const { page, pageSize, date, status } = params
    const dateStart = date ? date.startOf('day').toDate() : undefined
    const dateEnd = date ? date.endOf('day').toDate() : undefined

    const dateCondition =
      dateStart && dateEnd ? { updatedAt: Between(dateStart, dateEnd) } : {}

    const [orders, count] = await this.findAndCount({
      where: {
        user: { id: userId },
        status,
        ...dateCondition,
      },
      order: {
        updatedAt: 'DESC',
      },
      relations: { items: { product: true } },
      take: pageSize,
      skip: (page - 1) * pageSize,
    })

    return [count, orders]
  }

  async findOrders(params: OrderQueryParams): Promise<[number, Order[]]> {
    const { page, pageSize, status, date } = params
    const dateStart = date ? date.startOf('day').toDate() : undefined
    const dateEnd = date ? date.endOf('day').toDate() : undefined

    const dateCondition =
      dateStart && dateEnd ? { updatedAt: Between(dateStart, dateEnd) } : {}

    const [orders, count] = await this.findAndCount({
      where: {
        status,
        ...dateCondition,
      },
      order: { updatedAt: 'DESC' },
      relations: { items: { product: true }, user: true },
      take: pageSize,
      skip: (page - 1) * pageSize,
    })

    return [count, orders]
  }

  async createOrder(
    queryRunner: QueryRunner,
    userId: string,
    data: Order,
  ): Promise<Order> {
    const order = await queryRunner.manager.save(
      queryRunner.manager.create(Order, {
        ...data,
        user: { id: userId },
      }),
    )
    return order
  }
}
