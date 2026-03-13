import { Invoice, PaymentIntent, TResponse } from '#types'

import { Order, User } from '#entities'

export interface IInvoiceMail {
  sendInvoice(
    user: User,
    invoice: TResponse<Invoice>,
    order: Order,
    currency: string,
  ): Promise<Order>

  sendConfirmationEmail(
    invoice: Invoice,
    user: User,
    paymentIntent: PaymentIntent,
  ): Promise<void>
}
