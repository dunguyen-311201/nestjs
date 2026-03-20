import { PaginationSchema } from './pagination'
import { ErrorResponseSchema, createPaginatedResponseSchema } from './response'

export const ProductSchema = {
  type: 'object',
  properties: {
    id: {
      type: 'string',
      description: 'Product ID',
      example: 'prod_123456',
    },
    name: {
      type: 'string',
      description: 'Product name',
      example: 'Laptop',
    },
    description: {
      type: 'string',
      description: 'Product description',
      example: 'High-performance laptop for professionals',
    },
    price: {
      type: 'number',
      description: 'Product price',
      example: 999.99,
    },
    stock: {
      type: 'integer',
      description: 'Available stock quantity',
      example: 50,
    },
    images: {
      type: 'array',
      items: {
        type: 'string',
      },
      description: 'Product images URLs',
      example: ['https://example.com/image1.jpg'],
    },
    image: {
      type: 'string',
      description: 'Product image URL',
      example: 'https://example.com/image1.jpg',
    },
    category: {
      type: 'string',
      description: 'Category name',
      example: 'Electronics',
    },
    createdAt: {
      type: 'string',
      format: 'date-time',
      description: 'Creation timestamp',
    },
    updatedAt: {
      type: 'string',
      format: 'date-time',
      description: 'Last update timestamp',
    },
    status: {
      type: 'string',
      enum: ['draft', 'published', 'archived', 'deleted'],
      description: 'Product status',
      default: 'draft',
      example: 'published',
    },
  },
  required: ['id', 'name', 'description', 'price', 'stock', 'category'],
} as const

export const addProductSchema = {
  type: 'object',
  properties: ProductSchema.properties,
  required: ['name', 'description', 'price', 'stock', 'category', 'status'],
} as const

export const updateProductSchema = {
  type: 'object',
  properties: ProductSchema.properties,
} as const

export const ProductListResponseSchema =
  createPaginatedResponseSchema(ProductSchema)

export const ProductDetailResponseSchema = ProductSchema

export const ProductCreateResponseSchema = addProductSchema

export const ProductUpdateResponseSchema = updateProductSchema

export const ProductErrorResponseSchema = ErrorResponseSchema

export const ProductQuerySchema = {
  type: 'object',
  properties: {
    ...PaginationSchema.properties,
    query: {
      type: 'string',
      description: 'Search query',
    },
    category: {
      type: 'string',
      description: 'Filter by category (comma-separated)',
    },
    status: {
      type: 'string',
      description:
        'Filter by status (draft, published, archived, deleted, all)',
    },
    orderBy: {
      type: 'string',
      enum: ['name', 'price', 'stock', 'createdAt', 'updatedAt'],
      description: 'Sort by field',
    },
    order: {
      type: 'string',
      enum: ['ASC', 'DESC', 'asc', 'desc'],
      description: 'Sort order (ASC, DESC)',
    },
  },
} as const
