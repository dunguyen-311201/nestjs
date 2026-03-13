import { QueryRunner } from 'typeorm'

import { BaseRepository } from '#repositories/base'

import { OrderQueryParams } from '#types'

import { Order } from '#entities'

export abstract class AbstractOrderRepository extends BaseRepository<Order> {
  abstract findOrdersByUserId(
    userId: string,
    params: OrderQueryParams,
  ): Promise<[number, Order[]]>
  abstract findPendingOrder(userId: string): Promise<Order | null>
  abstract findOrders(params: OrderQueryParams): Promise<[number, Order[]]>
  abstract createOrder(
    queryRunner: QueryRunner,
    userId: string,
    order: Partial<Order>,
  ): Promise<Order>

  abstract hasPendingOrder(userId: string): Promise<boolean>
}
