import { OrderQueryParams, Pagination } from '#types'

import { Order } from '#entities'

export interface IOrderService {
  getOrders(
    params: OrderQueryParams,
  ): Promise<{ data: Order[]; meta: { pagination: Pagination } }>

  getOrdersByUserId(
    userId: string,
    params: OrderQueryParams,
  ): Promise<{ data: Order[]; meta: { pagination: Pagination } }>

  updateOrderStatus(
    params: { orderId: number; userId?: string },
    status: Order['status'],
  ): Promise<Order>

  cancelOrder(params: { orderId: number; userId: string }): Promise<Order>

  getOrderById(orderId: number): Promise<Order>
}
