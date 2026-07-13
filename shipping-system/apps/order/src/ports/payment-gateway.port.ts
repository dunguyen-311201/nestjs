export interface CheckoutSession {
  checkoutUrl: string;
  sessionId: string;
}

export interface WebhookEvent {
  id: string;
  type: string;
  shipmentOrderId: string | null;
  externalReferenceId: string | null;
  status: string;
}

export abstract class IPaymentGateway {
  abstract createCheckoutSession(
    shipmentOrderId: string,
    amountCents: number,
  ): Promise<CheckoutSession>;

  // Throws on an invalid Stripe-Signature (mapped to 400 by the controller).
  abstract constructWebhookEvent(
    rawBody: Buffer,
    signature: string,
  ): WebhookEvent;
}
