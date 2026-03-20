export interface ICheckoutService {
  processPayment(
    payload: { currency: string },
    userStripeId: string,
  ): Promise<{ orderId: number; clientSecret: string }>
  handleSuccessfulPayment(stripeId: string, invoiceId: string): Promise<void>
}

export interface ConfirmationEmailPayload {
  paid_at: number
  receipt_url: string
  payment_method: string
  receipt_number: string
  invoice_url: string
  customer_name: string
  customer_email: string
  invoice_number: string
  currency: string
  total: number
}
