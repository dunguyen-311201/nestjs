export interface Product {
  id: string
  name: string
  description: string
  price: number
  images: string[]
  category: string
  stock: number
  status: 'draft' | 'published' | 'archived' | 'deleted'
  image: string
}

export interface CartItem {
  id: string
  quantity: number
  productId: string
  productName: string
  productImage: string
  productPrice: number
  productStock: number
}

export type CheckoutItem = Pick<
  CartItem,
  'productId' | 'productName' | 'productPrice' | 'quantity'
>

export interface PaymentIntent {
  clientSecret: string
  orderId: number
}

export interface Cart {
  id: number
  items: CartItem[]
  status: string
}

export type Category = {
  id: string
  name: string
  createdAt?: string
  updatedAt?: string
}

export type OrderStatus =
  | 'pending'
  | 'processing'
  | 'shipped'
  | 'delivered'
  | 'cancelled'

export interface OrderItem {
  productId: string
  name: string
  description?: string
  price: number
  quantity: number
  image: string
}

export interface Order {
  id: number
  userId: string
  date: string
  status: OrderStatus
  total: number
  items: OrderItem[]
  paymentSecret: string
  shippingAddress: {
    name: string
    address: string
    city: string
    zipCode: string
    country: string
  }
}

export type ApiResponse<T, E = object> = {
  success: boolean
  data: T
} & E

export type ApiPagination = {
  currentPage: number
  itemCount: number
  itemsPerPage: number
  totalItems: number
  totalPages: number
}

export type ProductSearchParams = {
  search?: string
  orderBy?: string
  order?: string
  category?: string
  page?: string
}
