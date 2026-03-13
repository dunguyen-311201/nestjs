export const CartProductSchema = {
  type: 'object',
  properties: {
    id: { type: 'string', example: 'prod_123' },
    name: { type: 'string', example: 'Laptop' },
    description: { type: 'string', example: 'High-performance laptop' },
    price: { type: 'number', example: 999.99 },
    stock: { type: 'number', example: 50 },
    reservedStock: { type: 'number', example: 0 },
    images: { type: 'array', items: { type: 'string' } },
    deleted: { type: ['boolean', 'null'] },
  },
  required: ['id', 'name', 'description', 'price', 'stock', 'reservedStock'],
  additionalProperties: true,
} as const

export const CartItemSchema = {
  type: 'object',
  properties: {
    id: { type: 'number', example: 1 },
    cartId: { type: 'number', example: 10 },
    quantity: { type: 'number', example: 2 },
    productId: { type: 'string', example: 'prod_123' },
    productName: { type: 'string', example: 'Laptop' },
    productPrice: { type: 'number', example: 999.99 },
    productStock: { type: 'number', example: 50 },
    productImage: { type: 'string', example: 'https://example.com/image.jpg' },
    productStatus: { type: 'string', example: 'published' },
  },
  required: ['id', 'quantity'],
  additionalProperties: true,
} as const

export const CartSchema = {
  type: 'object',
  properties: {
    id: { type: 'number', example: 10 },
    status: {
      type: 'string',
      enum: ['active', 'abandoned', 'converted'],
      example: 'active',
    },
    createdAt: { type: 'string', format: 'date-time' },
    updatedAt: { type: 'string', format: 'date-time' },
    items: {
      type: 'array',
      items: CartItemSchema,
    },
  },
  required: ['id', 'status', 'items'],
  additionalProperties: true,
} as const

export const CartItemUpdatedSchema = {
  type: 'object',
  properties: {
    updated: { type: 'boolean', example: true },
  },
  required: ['updated'],
  additionalProperties: false,
} as const
