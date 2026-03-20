import { Emptyable, MetadataParam } from './common'
import { Customer, DeletedCustomer, Payment } from './payment'
import { InvoiceLineItemPricing } from './price'

export interface InvoiceItemPreview {
  amount?: number
  currency?: string
  description?: string
  price?: string
  quantity?: number
  price_data: PriceData
}

export interface InvoiceLineItem {
  id: string
  object: 'line_item'
  amount: number
  currency: string
  description: string | null
  pricing: InvoiceLineItemPricing | null
  quantity: number | null
  subtotal: number
}

export interface ApiList<T> {
  object: 'list'
  data: Array<T>
  has_more: boolean
  url: string
}

/**
 * Represents a deleted invoice in the system
 */
export interface DeletedInvoice {
  id: string
  object: 'invoice'
  deleted: true
}

/**
 * Tracks timing of different invoice status transitions
 */
export interface InvoiceStatusTransitions {
  finalized_at: number | null
  marked_uncollectible_at: number | null
  paid_at: number | null
  voided_at: number | null
}

interface PaymentMethodCard {
  brand: string
  country: string | null
  description?: string | null
  display_brand: string | null
  exp_month: number
  exp_year: number
  fingerprint?: string | null
  funding: string
  issuer?: string | null
  last4: string
}

interface PaymentMethodLink {
  email: string | null
  persistent_token?: string
}

export type PaymentMethodType = 'card' | 'link'
export interface PaymentMethod {
  id: string
  object: 'payment_method'
  card?: PaymentMethodCard
  link?: PaymentMethodLink
  created: number
  customer: string | Customer | null
  customer_account: string | null
  type: PaymentMethodType
}

export interface Invoice {
  id: string
  object: 'invoice'
  account_country: string | null
  account_name: string | null
  amount_due: number
  amount_overpaid: number
  amount_paid: number
  amount_remaining: number
  amount_shipping: number
  attempt_count: number
  attempted: boolean
  auto_advance?: boolean
  automatically_finalizes_at: number | null
  created: number
  currency: string
  customer: string | Customer | DeletedCustomer | null
  customer_account: string | null
  customer_email: string | null
  customer_name: string | null
  customer_phone: string | null
  deleted?: void
  description: string | null
  lines: ApiList<InvoiceLineItem>
  number: string | null
  payments?: ApiList<InvoicePayment>
  statement_descriptor: string | null
  status: TInvoiceStatus | null
  total: number
  confirmation_secret?: InvoiceConfirmationSecret | null
  effective_at: number | null
  status_transitions: InvoiceStatusTransitions
  hosted_invoice_url?: string | null
  invoice_pdf?: string | null
  receipt_number: string | null
}

/**
 * The possible statuses for an invoice
 */
export type TInvoiceStatus = 'draft' | 'open' | 'paid' | 'failed' | 'void'

export enum InvoiceStatus {
  DRAFT = 'draft',
  OPEN = 'open',
  PAID = 'paid',
  FAILED = 'failed',
  VOID = 'void',
}

/**
 * Contains the client secret for invoice confirmation
 */
export interface InvoiceConfirmationSecret {
  client_secret: string
  type: string
}

export interface InvoicePayment {
  id: string
  object: 'invoice_payment'
  amount_paid: number | null
  amount_requested: number
  created: number
  currency: string
  invoice: string | Invoice | DeletedInvoice
  status: string
  payment?: Payment
}

/**
 * Price data for creating invoice items
 */
export interface PriceData {
  currency: string
  product: string
  unit_amount?: number
}

export interface InvoiceCreatePreviewParams {
  currency?: string
  customer?: string
  invoice_items?: Array<InvoiceItemPreview & { description?: string }>
}

export interface InvoiceItemCreateParams {
  amount?: number
  currency?: string
  customer?: string
  customer_account?: string
  description?: string
  invoice?: string
  quantity?: number
  price_data?: PriceData
  metadata?: Emptyable<MetadataParam>
}

export interface InvoiceItem {
  id: string
  object: 'invoiceitem'
  amount: number
  currency: string
  customer: string | Customer | DeletedCustomer
  customer_account: string | null
  date: number
  deleted?: void
  description: string | null
  invoice: string | Invoice | null
  quantity: number
  metadata?: Emptyable<MetadataParam>
}

export interface InvoiceCreateParams {
  auto_advance?: boolean
  automatically_finalizes_at?: number
  currency?: string
  customer?: string
  customer_account?: string
  default_payment_method?: string
  description?: string
}
