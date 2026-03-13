import { ErrorResponseSchema } from './response'

export const ProductMetricSchema = {
  type: 'object',
  properties: {
    totalProducts: { type: 'number', example: 10 },
    totalStock: { type: 'number', example: 100 },
    totalValue: { type: 'number', example: 1000 },
    updatedAt: { type: 'string', format: 'date-time' },
  },
  required: ['totalProducts', 'totalStock', 'totalValue', 'updatedAt'],
  additionalProperties: false,
} as const

export const MetricErrorResponseSchema = ErrorResponseSchema
