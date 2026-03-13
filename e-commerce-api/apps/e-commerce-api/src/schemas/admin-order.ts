export const updateOrderStatusSchema = {
  type: 'object',
  properties: {
    status: {
      type: 'string',
      enum: ['pending', 'processing', 'shipped', 'delivered', 'cancelled'],
    },
  },
  required: ['status'],
} as const
