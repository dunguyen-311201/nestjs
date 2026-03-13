'use server'

import { API_ROUTES, get } from './api'
import { config } from './config'
import { ApiResponse, Category } from './types'

export const fetchCategories = async () => {
  const response = await get<ApiResponse<Category[]>>(
    `${config.api.endpoint}${API_ROUTES.CATEGORY.GET}`,
    {},
    { next: { revalidate: 3600, tags: ['categories'] } },
  )
  return response.data
}
