import { UnauthorizedError } from './errors'

const defaultHeaders = {}

async function handleResponse<T>(response: Response): Promise<T> {
  const contentType = response.headers.get('content-type')
  const isJson = contentType && contentType.includes('application/json')

  if (!response.ok) {
    let message = 'Something went wrong'
    if (isJson) {
      const error = (await response.json()) as { message: string }
      message = error.message || message
    } else {
      message = `Error ${response.status}: ${response.statusText}`
    }

    if (response.status === 401) {
      throw new UnauthorizedError(message)
    }

    throw new Error(message)
  }

  if (response.status === 204) {
    return true as T
  }

  if (!isJson) {
    throw new Error(`Expected JSON but received ${contentType}`)
  }

  return response.json()
}

export async function get<T>(
  path: string,
  headers: HeadersInit = {},
  options: Partial<RequestInit> = {},
): Promise<T> {
  const response = await fetch(path, {
    ...options,
    headers: { ...defaultHeaders, ...headers },
  })

  return handleResponse<T>(response)
}

export async function post<T>(
  path: string,
  data: unknown,
  headers: HeadersInit = {},
): Promise<T> {
  const response = await fetch(path, {
    method: 'POST',
    headers: {
      ...defaultHeaders,
      'Content-Type': 'application/json',
      ...headers,
    },
    body: JSON.stringify(data),
  })
  return handleResponse<T>(response)
}

export async function put<T>(
  path: string,
  data: unknown,
  headers: HeadersInit = {},
): Promise<T> {
  const response = await fetch(path, {
    method: 'PUT',
    headers: {
      ...defaultHeaders,
      'Content-Type': 'application/json',
      ...headers,
    },
    body: JSON.stringify(data),
  })
  return handleResponse<T>(response)
}

export async function patch<T>(
  path: string,
  data: unknown,
  headers: HeadersInit = {},
): Promise<T> {
  const response = await fetch(path, {
    method: 'PATCH',
    headers: {
      ...defaultHeaders,
      'Content-Type': 'application/json',
      ...headers,
    },
    body: JSON.stringify(data),
  })
  return handleResponse<T>(response)
}

export async function del<T>(
  path: string,
  headers: HeadersInit = {},
): Promise<T> {
  const response = await fetch(path, {
    method: 'DELETE',
    headers: { ...defaultHeaders, ...headers },
  })
  return handleResponse<T>(response)
}

export const API_ROUTES = {
  AUTH: {
    LOGIN: '/auth/login',
    REGISTER: '/auth/register',
  },
  USER: {
    PROFILE: '/users/me',
    UPDATE_ROLE: '/users/update-role',
  },
  PRODUCT: {
    GET: '/products',
    GET_BY_ID: (id: string) => `/products/${id}`,
    CREATE: '/admin/products',
    UPDATE: (id: string) => `/admin/products/${id}`,
    DELETE: (id: string) => `/admin/products/${id}`,
  },
  CATEGORY: {
    GET: '/categories',
    GET_BY_ID: (id: string) => `/categories/${id}`,
    CREATE: '/admin/categories',
    UPDATE: (id: string) => `/admin/categories/${id}`,
    DELETE: (id: string) => `/admin/categories/${id}`,
  },
  CART: {
    GET: '/cart',
    ADD_ITEM: '/cart/add-item',
    DELETE_ITEM: (id: string) => `/cart/items/${id}`,
    UPDATE_ITEM: (id: string) => `/cart/items/${id}`,
  },
  ORDER: {
    GET: '/orders',
    GET_BY_ID: (id: number) => `/orders/${id}`,
    GET_ALL: '/admin/orders',
    UPDATE_STATUS: (id: number) => `/admin/orders/${id}/status`,
    DELETE: (id: number) => `/admin/orders/${id}`,
    CANCEL: (id: number) => `/orders/${id}/cancel`,
  },
  CHECKOUT: {
    CREATE: '/checkout',
  },
  METRIC: {
    PRODUCT: '/metrics/product',
  },
}
