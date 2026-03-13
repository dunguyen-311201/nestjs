import { ErrorResponseSchema } from './response'

export const createPaymentIntentSchema = {
  type: 'object',
  required: ['currency'],
  additionalProperties: true,
  properties: {
    currency: { type: 'string', pattern: '^[a-z]{3}$' },
  },
} as const

export const paymentSuccessSchema = {
  type: 'object',
  required: ['data', 'type'],
  additionalProperties: true,
  properties: {
    data: {
      type: 'object',
      required: ['object'],
      properties: {
        object: {
          type: 'object',
          required: [
            'id',
            'object',
            'account_name',
            'amount_paid',
            'currency',
            'customer_email',
            'lines',
            'status',
            'total',
            'customer',
          ],
          properties: {
            id: { type: 'string' },
            object: { type: 'string', enum: ['invoice'] },
            account_country: { type: 'string' },
            account_name: { type: 'string' },
            amount_paid: { type: 'integer' },
            currency: {
              type: 'string',
              minLength: 3,
              maxLength: 3,
            },
            customer: { type: 'string' },
            customer_email: { type: 'string', format: 'email' },
            customer_name: { type: ['string', 'null'] },
            hosted_invoice_url: { type: 'string', format: 'uri' },
            invoice_pdf: { type: 'string', format: 'uri' },
            number: { type: 'string' },
            status: {
              type: 'string',
              enum: ['draft', 'open', 'paid', 'void', 'uncollectible'],
            },
            total: { type: 'integer' },
            total_excluding_tax: { type: 'integer' },
            period_start: { type: 'integer' },
            period_end: { type: 'integer' },
            webhooks_delivered_at: { type: 'integer' },
            status_transitions: {
              type: 'object',
              properties: {
                finalized_at: { type: 'integer' },
                paid_at: { type: 'integer' },
              },
              additionalProperties: false,
            },
            next_payment_attempt: { type: ['integer', 'null'] },
            lines: {
              type: 'object',
              required: ['object', 'data'],
              properties: {
                object: { type: 'string', enum: ['list'] },
                has_more: { type: 'boolean' },
                total_count: { type: 'integer' },
                url: { type: 'string' },
                data: {
                  type: 'array',
                  items: {
                    type: 'object',
                    required: [
                      'id',
                      'amount',
                      'currency',
                      'description',
                      'quantity',
                    ],
                    properties: {
                      id: { type: 'string' },
                      object: {
                        type: 'string',
                        enum: ['line_item'],
                      },
                      amount: { type: 'integer' },
                      currency: { type: 'string' },
                      description: { type: 'string' },
                      quantity: { type: 'integer' },
                      subtotal: { type: 'integer' },
                      pricing: {
                        type: 'object',
                        properties: {
                          type: { type: 'string' },
                          unit_amount_decimal: {
                            type: 'string',
                          },
                          price_details: {
                            type: 'object',
                            properties: {
                              price: {
                                type: 'string',
                              },
                              product: {
                                type: 'string',
                              },
                            },
                            additionalProperties: true,
                          },
                        },
                        additionalProperties: true,
                      },
                    },
                    additionalProperties: true,
                  },
                },
              },
              additionalProperties: false,
            },
          },
          additionalProperties: true,
        },
      },
      additionalProperties: false,
    },
    type: { type: 'string', enum: ['invoice.payment_succeeded'] },
  },
} as const

export const PaymentIntentResponseSchema = {
  type: 'object',
  properties: {
    clientSecret: { type: 'string', example: 'pi_123_secret_abc' },
    orderId: { type: 'number', example: 1 },
    status: { type: 'string', example: 'pending' },
    total: { type: 'number', example: 100 },
    items: {
      type: 'array',
      items: {
        type: 'object',
        properties: {
          productId: { type: 'string', example: 'prod_123' },
          productName: { type: 'string', example: 'Product Name' },
          productPrice: { type: 'number', example: 100 },
          quantity: { type: 'number', example: 1 },
        },
      },
    },
  },
  required: ['clientSecret', 'orderId'],
  additionalProperties: false,
} as const

export const StripeWebhookAckSchema = {
  type: 'object',
  properties: {
    received: { type: 'boolean', example: true },
  },
  required: ['received'],
  additionalProperties: false,
} as const

export const CheckoutErrorResponseSchema = ErrorResponseSchema
