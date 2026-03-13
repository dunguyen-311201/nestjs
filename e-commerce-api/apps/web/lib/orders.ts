import { API_ROUTES, get, patch } from './api'
import { createAuthorizationHeader } from './auth'
import { config } from './config'
import { ApiPagination, ApiResponse, Order, OrderStatus } from './types'

export async function getUserOrders(page: number = 1, pageSize: number = 10) {
  const headers = await createAuthorizationHeader()

  const response = await get<
    ApiResponse<Order[], { meta: { pagination: ApiPagination } }>
  >(`${config.api.endpoint}/orders?page=${page}&pageSize=${pageSize}`, headers)

  return response
}

type AllOrdersResponse = ApiResponse<
  Order[],
  { meta: { pagination: ApiPagination } }
>
export async function getAllOrders(
  page: number = 1,
  pageSize: number = 20,
  status?: string,
  date?: string,
) {
  const headers = await createAuthorizationHeader()
  const params = new URLSearchParams({
    page: page.toString(),
    pageSize: pageSize.toString(),
  })

  if (status) params.append('status', status)
  if (date) params.append('date', date)

  const url = `${config.api.endpoint}${API_ROUTES.ORDER.GET_ALL}?${params.toString()}`
  const response = await get<AllOrdersResponse>(url, headers)
  return response
}

export async function updateOrderStatus(orderId: number, status: OrderStatus) {
  const headers = await createAuthorizationHeader()

  const response = await patch<ApiResponse<Order>>(
    `${config.api.endpoint}${API_ROUTES.ORDER.UPDATE_STATUS(orderId)}`,
    { status },
    headers,
  )

  return response.data
}

export async function getOrder(orderId: number) {
  const headers = await createAuthorizationHeader()

  const response = await get<Order>(
    `${config.api.endpoint}${API_ROUTES.ORDER.GET_BY_ID(orderId)}`,
    headers,
  )

  return response
}
