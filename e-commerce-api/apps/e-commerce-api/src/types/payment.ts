import { MetadataParam } from './common'
import {
  Invoice,
  InvoiceItemCreateParams,
  InvoicePayment,
  PaymentMethod,
} from './invoice'
import { IProduct, ProductCreateParams } from './product'

export interface CustomerCreateParams {
  description?: string
  email?: string
  name?: string
  payment_method?: string
  phone?: string
}

export type TResponse<T> = T & {
  lastResponse: {
    headers: { [key: string]: string }
    requestId: string
    statusCode: number
    apiVersion?: string
    idempotencyKey?: string
    stripeAccount?: string
  }
}

export interface Payment {
  payment_intent?: string | PaymentIntent
  type: string
}

export interface DeletedCustomer {
  id: string
  object: 'customer'
  deleted: true
}

export interface PaymentIntentCreateParams {
  amount: number
  currency: string
  confirmation_token?: string
  customer?: string
  customer_account?: string
  payment_method?: string
}

export interface PaymentIntent {
  id: string
  object: 'payment_intent'
  amount: number
  amount_capturable: number
  canceled_at: number | null
  client_secret: string | null
  created: number
  currency: string
  customer: string | Customer | DeletedCustomer | null
  customer_account: string | null
  description: string | null
  status: PaymentIntentStatus
  payment_method: PaymentMethod | null
  latest_charge: Charge
}

export interface Charge {
  id: string
  object: 'charge'
  amount: number
  amount_captured: number
  amount_refunded: number
  application_fee_amount: number | null
  authorization_code?: string
  calculated_statement_descriptor: string | null
  captured: boolean
  created: number
  currency: string
  customer: string | Customer | DeletedCustomer | null
  description: string | null
  paid: boolean
  payment_intent: string | PaymentIntent | null
  payment_method: PaymentMethod
  receipt_email: string | null
  receipt_number: string | null
  receipt_url: string
}

/**
 * Tracks timing of different payment status transitions
 */
export interface StatusTransitions {
  canceled_at: number | null
  paid_at: number | null
}

export type InvoicePaymentExpand = Omit<InvoicePayment, 'payment'> & {
  status_transitions: StatusTransitions
  payment: {
    payment_intent: PaymentIntent & {
      payment_method: PaymentMethod
      latest_charge: Charge
    }
  }
}

type PaymentIntentStatus =
  | 'canceled'
  | 'processing'
  | 'requires_action'
  | 'requires_capture'
  | 'requires_confirmation'
  | 'requires_payment_method'
  | 'succeeded'

export interface Customer {
  id: string
  object: 'customer'
  balance: number
  business_name?: string
  created: number
  currency?: string | null
  customer_account?: string | null
  deleted?: void
  description: string | null
  email: string | null
  name?: string | null
  phone?: string | null
  metadata: MetadataParam
}

export type PaymentDetails = {
  receipt_url: string
  payment_method: PaymentMethod
  paymentIntentId: string
  paid_at: number
}

export interface PaymentGateway {
  findOrCreateCustomer(params: CustomerCreateParams): Promise<Customer>
  createCustomer(params: CustomerCreateParams): Promise<Customer>
  createProduct(params: ProductCreateParams): Promise<TResponse<IProduct>>
  getInvoice(id: string): Promise<TResponse<Invoice>>
  getPaymentIntent(id: string): Promise<TResponse<PaymentIntent>>
  processPayment(params: {
    items: InvoiceItemCreateParams[]
    currency: string
    customer: string
  }): Promise<TResponse<Invoice>>
}
