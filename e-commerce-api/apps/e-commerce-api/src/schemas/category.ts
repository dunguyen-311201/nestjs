import { ErrorResponseSchema } from './response'

export const CategorySchema = {
  type: 'object',
  properties: {
    id: {
      type: 'string',
      description: 'Category ID',
      example: 'cat_123',
    },
    name: {
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
  },
  required: ['id', 'name'],
} as const

export const CategoryListResponseSchema = {
  type: 'object',
  properties: {
    data: {
      type: 'array',
      items: CategorySchema,
    },
  },
  required: ['data'],
} as const

export const CategoryErrorResponseSchema = ErrorResponseSchema
