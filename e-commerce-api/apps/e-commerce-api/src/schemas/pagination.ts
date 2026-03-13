export const PaginationSchema = {
  $id: 'pagination',
  type: 'object',
  properties: {
    page: {
      type: 'integer',
      minimum: 1,
      default: 1,
      description: 'The page number to retrieve',
    },
    pageSize: {
      type: 'integer',
      minimum: 1,
      maximum: 50,
      default: 10,
      description: 'Number of items per page',
    },
  },
} as const
