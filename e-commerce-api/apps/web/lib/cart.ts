import { get } from './api'
import { createAuthorizationHeader } from './auth'
import { config } from './config'
import { Cart } from './types'

export const getCarts = async () => {
  try {
    const headers = await createAuthorizationHeader()
    const response = await get<Cart>(`${config.api.endpoint}/cart`, headers)

    return response.items
  } catch {
    return []
  }
}
