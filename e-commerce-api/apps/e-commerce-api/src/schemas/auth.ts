import { ErrorResponseSchema } from './response'
import { UserSchema } from './user'

export const RegisterResponseSchema = UserSchema
export const AuthErrorResponseSchema = ErrorResponseSchema
export const LoginResponseSchema = {
  type: 'object',
  description: 'Login successful',
  properties: {
    jwt: { type: 'string' },
    user: UserSchema,
  },
  required: ['jwt', 'user'],
}

export const loginBodySchema = {
  type: 'object',
  required: ['identifier', 'password'],
  properties: {
    identifier: { type: 'string' },
    password: { type: 'string' },
  },
} as const

export const registerBodySchema = {
  type: 'object',
  required: ['data'],
  additionalProperties: true,
  properties: {
    data: {
      type: 'object',
      additionalProperties: true,
      required: [
        'email_addresses',
        'first_name',
        'last_name',
        'username',
        'created_at',
        'updated_at',
        'phone_numbers',
        'image_url',
        'id',
      ],
      properties: {
        email_addresses: {
          type: 'array',
          items: {
            type: 'object',
            additionalProperties: true,
            required: ['email_address'],
            properties: {
              email_address: { type: 'string', format: 'email' },
            },
          },
        },
        first_name: { type: 'string' },
        last_name: { type: 'string' },
        username: { type: 'string' },
        created_at: { type: 'string' },
        updated_at: { type: 'string' },
        phone_numbers: {
          type: 'array',
          items: {
            type: 'object',
            additionalProperties: true,
            required: ['phone_number'],
            properties: { phone_number: { type: 'string' } },
          },
        },
        image_url: { type: 'string' },
        id: { type: 'string' },
      },
    },
  },
} as const
