export const SuccessResponseSchema = {
  type: 'object',
  properties: {
    data: {
      description: 'Response data',
    },
  },
  required: ['data'],
} as const

export const PaginatedResponseSchema = {
  type: 'object',
  properties: {
    data: {
      type: 'array',
      description: 'Array of items',
    },
    meta: {
      type: 'object',
      properties: {
        pagination: {
          type: 'object',
          properties: {
            totalItems: {
              type: 'integer',
              example: 100,
            },
            itemCount: {
              type: 'integer',
              example: 10,
            },
            itemsPerPage: {
              type: 'integer',
              example: 10,
            },
            totalPages: {
              type: 'integer',
              example: 10,
            },
            currentPage: {
              type: 'integer',
              example: 1,
            },
          },
          required: [
            'totalItems',
            'itemCount',
            'itemsPerPage',
            'totalPages',
            'currentPage',
          ],
        },
      },
      required: ['pagination'],
    },
  },
  required: ['data', 'meta'],
} as const

export const ErrorResponseSchema = {
  type: 'object',
  properties: {
    message: {
      type: 'string',
      description: 'Error message',
      example: 'Resource not found',
    },
    status: {
      type: 'integer',
      description: 'HTTP status code',
      example: 404,
    },
    details: {
      description: 'Additional error details (optional)',
    },
  },
  required: ['message', 'status'],
} as const

export function createSuccessResponseSchema(dataSchema: unknown) {
  return {
    ...SuccessResponseSchema,
    properties: {
      ...SuccessResponseSchema.properties,
      data: dataSchema,
    },
  }
}

export function createPaginatedResponseSchema(itemSchema: unknown) {
  return {
    ...PaginatedResponseSchema,
    properties: {
      ...PaginatedResponseSchema.properties,
      data: {
        type: 'array',
        items: itemSchema,
      },
    },
  }
}
