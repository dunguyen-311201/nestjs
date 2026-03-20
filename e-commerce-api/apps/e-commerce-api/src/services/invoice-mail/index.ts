import { FastifyBaseLogger } from 'fastify'

import env from '#env'

import {
  formatAmount,
  formatPaymentMethod,
  formatStripeAmount,
  formatStripeDate,
} from '#utils/format'
import { formatInvoiceItems } from '#utils/invoice'

import {
  EmailProvider,
  Invoice,
  MailTemplate,
  PaymentIntent,
  PaymentMethod,
  TResponse,
} from '#types'

import { Order, User } from '#entities'

import { IInvoiceMail } from './type'

export class InvoiceMail implements IInvoiceMail {
  constructor(
    private mailProvider: EmailProvider,
    private logger: FastifyBaseLogger,
  ) {}

  async sendInvoice(
    user: User,
    invoice: TResponse<Invoice>,
    order: Order,
    currency: string,
  ): Promise<Order> {
    const { email, name } = user
    const { client_secret } = invoice.confirmation_secret || {}

    await this.mailProvider.send({
      from: env.mail.fromEmail,
      to: email,
      templateName: MailTemplate.PAYMENT,
      subject: `[${env.app.name}] - Invoice - #${invoice.number}`,
      dynamicTemplateData: {
        company_name: env.app.name,
        invoice_id: invoice.number!,
        customer_name: name,
        amount_due: formatAmount(
          invoice.amount_due / 100,
          currency.toUpperCase(),
        ),
        due_date: formatStripeDate(invoice.created),
        invoice_url: client_secret
          ? `${env.client.baseUrl}/checkout?clientSecret=${client_secret}&orderId=${order.id}`
          : invoice.hosted_invoice_url!,
        support_email: env.mail.supportEmail,
        help_center_url: 'https://moderncloud.com/help',
        subject: `Invoice ${invoice.number} for ${name}`,
      },
    })

    return order
  }

  async sendConfirmationEmail(
    invoice: Invoice,
    user: User,
    paymentIntent: PaymentIntent,
  ): Promise<void> {
    const items = formatInvoiceItems(invoice)
    const {
      currency,
      total,
      number: invoice_number,
      receipt_number,
      invoice_pdf,
      status_transitions,
    } = invoice
    const { email: customer_email, name: customer_name } = user
    const payment_method = paymentIntent.payment_method ?? ({} as PaymentMethod)
    const { receipt_url } = paymentIntent.latest_charge ?? {}
    const formattedPaymenMethod = formatPaymentMethod(payment_method)

    this.logger.debug(
      { customer_email, invoice_number },
      'Sending confirmation email',
    )

    await this.mailProvider.send({
      from: env.mail.fromEmail,
      to: customer_email,
      templateName: MailTemplate.INVOICE,
      subject: `Payment receipt from ${env.app.name} #${receipt_number ?? invoice_number}`,
      dynamicTemplateData: {
        name: customer_name,
        email: customer_email,
        company_name: env.app.name,
        support_email: env.mail.supportEmail,
        amount_paid: formatStripeAmount(total, currency),
        paid_date: formatStripeDate(status_transitions.paid_at || Date.now()),
        receipt_number: receipt_number!,
        invoice_number: invoice_number!,
        payment_method: formattedPaymenMethod,
        invoice_url: invoice_pdf!,
        receipt_url: receipt_url,
        items: items.map(({ unitPrice, quantity, productName }) => ({
          quantity,
          unit_price: formatAmount(unitPrice, currency),
          total: formatAmount(unitPrice * quantity, currency),
          name: productName,
        })),
      },
    })
    this.logger.info(
      { customer_email, invoice_number },
      'Confirmation email sent successfully',
    )
  }
}
