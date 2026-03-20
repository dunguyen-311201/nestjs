import { FastifyBaseLogger } from 'fastify'

import Stripe from 'stripe'

import '#types/error'
import { IProduct, ProductCreateParams } from '#types/product'

import {
  ApiList,
  Customer,
  CustomerCreateParams,
  Invoice,
  InvoiceCreateParams,
  InvoiceItem,
  InvoiceItemCreateParams,
  PaymentGateway,
  PaymentIntent,
  TResponse,
} from '#types'

export class StripePaymentAdapter implements PaymentGateway {
  constructor(
    private stripe: Stripe,
    private logger: FastifyBaseLogger,
  ) {}

  async findOrCreateCustomer(params: CustomerCreateParams): Promise<Customer> {
    const response = await this.stripe.customers.list({
      email: params.email,
      limit: 1,
    })
    let customer: Customer | undefined = response.data[0]
    if (!customer) {
      customer = await this.createCustomer(params)
    }

    return customer
  }

  async createCustomer(params: CustomerCreateParams): Promise<Customer> {
    const customer = await this.stripe.customers.create(params)
    return customer
  }

  async createProduct(
    params: ProductCreateParams,
  ): Promise<TResponse<IProduct>> {
    return (await this.stripe.products.create(params)) as TResponse<IProduct>
  }

  async createInvoice({
    customer: customerId,
    ...params
  }: InvoiceCreateParams): Promise<TResponse<Invoice>> {
    const drafts = await this.stripe.invoices.list({
      customer: customerId,
      status: 'open',
      limit: 10,
    })

    if (drafts.data.length > 0) {
      await Promise.all(
        drafts.data.map((item) => this.stripe.invoices.voidInvoice(item.id)),
      )
    }

    const invoice = await this.stripe.invoices.create({
      customer: customerId,
      auto_advance: true,
      ...params,
    })

    return invoice as TResponse<Invoice>
  }

  async createInvoiceItem(
    params: InvoiceItemCreateParams,
  ): Promise<TResponse<InvoiceItem>> {
    return (await this.stripe.invoiceItems.create(
      params,
    )) as TResponse<InvoiceItem>
  }

  async finalizeInvoice(id: string): Promise<TResponse<Invoice>> {
    return (await this.stripe.invoices.finalizeInvoice(id, {
      expand: ['confirmation_secret'],
    })) as TResponse<Invoice>
  }

  async getPaymentIntent(id: string): Promise<TResponse<PaymentIntent>> {
    return (await this.stripe.paymentIntents.retrieve(id, {
      expand: ['payment_method', 'latest_charge'],
    })) as unknown as TResponse<PaymentIntent>
  }

  async getInvoice(id: string): Promise<TResponse<Invoice>> {
    try {
      const invoice = await this.stripe.invoices.retrieve(id, {
        expand: ['payments.data.payment.payment_intent'],
      })
      return invoice as TResponse<Invoice>
    } catch (error) {
      this.logger.error(`Error - getInvoice: ${error}`)
      throw error
    }
  }

  async getProducts({
    starting_after,
    limit = 10,
  }: {
    starting_after?: string
    limit?: number
  }): Promise<TResponse<ApiList<IProduct>>> {
    const products = (await this.stripe.products.list({
      active: true,
      limit,
      expand: ['data.default_price'],
      ...(starting_after && { starting_after }),
    })) as TResponse<ApiList<IProduct>>
    return products
  }

  async processPayment({
    currency,
    customer,
    items,
  }: {
    items: InvoiceItemCreateParams[]
    currency: string
    customer: string
  }): Promise<TResponse<Invoice>> {
    const invoice = await this.createInvoice({
      currency,
      customer,
    })

    await Promise.all(
      items.map((item) =>
        this.createInvoiceItem({ ...item, invoice: invoice.id }),
      ),
    )

    const finalizeInvoice = await this.finalizeInvoice(invoice.id)
    return finalizeInvoice
  }
}
