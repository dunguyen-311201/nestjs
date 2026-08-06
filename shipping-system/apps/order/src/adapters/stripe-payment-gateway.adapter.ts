import { Inject, Injectable } from '@nestjs/common';
import Stripe from 'stripe';
import {
  CheckoutSession,
  IPaymentGateway,
  WebhookEvent,
} from '../ports/payment-gateway.port';

export const STRIPE_CLIENT = Symbol('STRIPE_CLIENT');
export const STRIPE_WEBHOOK_SECRET = Symbol('STRIPE_WEBHOOK_SECRET');

@Injectable()
export class StripePaymentGateway implements IPaymentGateway {
  constructor(
    @Inject(STRIPE_CLIENT) private readonly stripe: Stripe,
    @Inject(STRIPE_WEBHOOK_SECRET) private readonly webhookSecret: string,
  ) {}

  async createCheckoutSession(
    shipmentOrderId: string,
    amountCents: number,
  ): Promise<CheckoutSession> {
    const session = await this.stripe.checkout.sessions.create({
      mode: 'payment',
      // client_reference_id ties the session back to the order - the
      // webhook resolves the order this way, no stripe_session_id column
      // needs to exist on PAYMENT/PAYMENT_TRANSACTION.
      client_reference_id: shipmentOrderId,
      line_items: [
        {
          price_data: {
            currency: 'usd',
            unit_amount: amountCents,
            product_data: { name: `Shipment order ${shipmentOrderId}` },
          },
          quantity: 1,
        },
      ],
      success_url: `${process.env.CHECKOUT_SUCCESS_URL ?? 'http://localhost:3000/checkout/success'}?session_id={CHECKOUT_SESSION_ID}`,
      cancel_url:
        process.env.CHECKOUT_CANCEL_URL ??
        'http://localhost:3000/checkout/cancel',
    });

    return {
      checkoutUrl: session.url as string,
      sessionId: session.id,
    };
  }

  constructWebhookEvent(rawBody: Buffer, signature: string): WebhookEvent {
    const event = this.stripe.webhooks.constructEvent(
      rawBody,
      signature,
      this.webhookSecret,
    );

    if (
      event.type !== 'checkout.session.completed' &&
      event.type !== 'checkout.session.expired'
    ) {
      return {
        id: event.id,
        type: event.type,
        shipmentOrderId: null,
        externalReferenceId: null,
        status: 'ignored',
      };
    }

    const session = event.data.object;
    const paymentIntent = session.payment_intent;
    return {
      id: event.id,
      type: event.type,
      shipmentOrderId: session.client_reference_id ?? null,
      externalReferenceId:
        typeof paymentIntent === 'string'
          ? paymentIntent
          : (paymentIntent?.id ?? null),
      status: session.payment_status,
    };
  }
}
