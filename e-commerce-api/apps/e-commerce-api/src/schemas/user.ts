import { ErrorResponseSchema } from './response'

export const UserSchema = {
  type: 'object',
  properties: {
    id: { type: 'string', example: 'user_123' },
    username: { type: ['string', 'null'], example: 'john_doe' },
    firstName: { type: 'string', example: 'John' },
    lastName: { type: ['string', 'null'], example: 'Doe' },
    age: { type: ['number', 'null'], example: 25 },
    email: { type: 'string', format: 'email', example: 'john@example.com' },
    phone: { type: ['string', 'null'], example: '+1234567890' },
    avatar: { type: ['string', 'null'], example: 'https://example.com/a.png' },
    stripeId: { type: ['string', 'null'], example: 'cus_123' },
    role: { type: ['string', 'null'], example: 'USER' },
    createdAt: { type: 'string', format: 'date-time' },
    updatedAt: { type: 'string', format: 'date-time' },
  },
  required: [
    'id',
    'firstName',
    'email',
    'createdAt',
    'updatedAt',
    'stripeId',
    'role',
  ],
  additionalProperties: true,
} as const

export const UserProfileResponseSchema = {
  type: 'object',
  properties: {
    id: { type: 'string' },
    email: { type: 'string' },
    name: { type: 'string' },
    avatar: { type: 'string' },
    firstName: { type: 'string' },
    lastName: { type: 'string' },
    username: { type: 'string' },
    phone: { type: 'string' },
    age: { type: 'number' },
    role: { type: 'string' },
    stripeId: { type: 'string' },
    updatedAt: { type: 'string' },
    createdAt: { type: 'string' },
  },
  required: [
    'id',
    'firstName',
    'email',
    'createdAt',
    'updatedAt',
    'avatar',
    'stripeId',
    'role',
  ],
}

export const UserErrorResponseSchema = ErrorResponseSchema

export const UpdateUserRoleSchema = {
  type: 'object',
  properties: {
    data: {
      type: 'object',
      properties: {
        role_name: { type: 'string', enum: ['User', 'Admin'] },
        role: { type: 'string', enum: ['org:user', 'org:admin'] },
        public_user_data: {
          type: 'object',
          properties: {
            user_id: { type: 'string' },
          },
          required: ['user_id'],
        },
      },
      required: ['role_name', 'role', 'public_user_data'],
    },
    type: { type: 'string', enum: ['organizationMembership.updated'] },
    object: { type: 'string', enum: ['event'] },
  },
  required: ['data', 'type', 'object'],
} as const
