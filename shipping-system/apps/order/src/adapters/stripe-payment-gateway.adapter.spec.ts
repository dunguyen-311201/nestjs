import { StripePaymentGateway } from './stripe-payment-gateway.adapter';

describe('StripePaymentGateway', () => {
  let create: jest.Mock;
  let constructEvent: jest.Mock;
  let stripeClient: {
    checkout: { sessions: { create: jest.Mock } };
    webhooks: { constructEvent: jest.Mock };
  };
  let gateway: StripePaymentGateway;

  beforeEach(() => {
    create = jest.fn();
    constructEvent = jest.fn();
    stripeClient = {
      checkout: { sessions: { create } },
      webhooks: { constructEvent },
    };
    gateway = new StripePaymentGateway(stripeClient as never, 'whsec_test');
  });

  describe('createCheckoutSession', () => {
    it('creates a Stripe Checkout Session tagged with the shipment_order_id and returns its url/id', async () => {
      create.mockResolvedValue({
        id: 'cs_test_1',
        url: 'https://checkout.stripe.com/cs_test_1',
      });

      const result = await gateway.createCheckoutSession('order-1', 5000);

      const call = create.mock.calls[0][0] as {
        mode: string;
        client_reference_id: string;
        line_items: { price_data: { unit_amount: number }; quantity: number }[];
      };
      expect(call.mode).toBe('payment');
      expect(call.client_reference_id).toBe('order-1');
      expect(call.line_items[0].price_data.unit_amount).toBe(5000);
      expect(call.line_items[0].quantity).toBe(1);
      expect(result).toEqual({
        checkoutUrl: 'https://checkout.stripe.com/cs_test_1',
        sessionId: 'cs_test_1',
      });
    });
  });

  describe('constructWebhookEvent', () => {
    it('maps a checkout.session.completed event to the shared WebhookEvent shape', () => {
      constructEvent.mockReturnValue({
        id: 'evt_1',
        type: 'checkout.session.completed',
        data: {
          object: {
            client_reference_id: 'order-1',
            payment_intent: 'pi_123',
            payment_status: 'paid',
          },
        },
      });

      const result = gateway.constructWebhookEvent(
        Buffer.from('{}'),
        'sig_header',
      );

      expect(constructEvent).toHaveBeenCalledWith(
        Buffer.from('{}'),
        'sig_header',
        'whsec_test',
      );
      expect(result).toEqual({
        id: 'evt_1',
        type: 'checkout.session.completed',
        shipmentOrderId: 'order-1',
        externalReferenceId: 'pi_123',
        status: 'paid',
      });
    });

    it('maps a checkout.session.expired event to the shared WebhookEvent shape', () => {
      constructEvent.mockReturnValue({
        id: 'evt_3',
        type: 'checkout.session.expired',
        data: {
          object: {
            client_reference_id: 'order-1',
            payment_intent: null,
            payment_status: 'unpaid',
          },
        },
      });

      const result = gateway.constructWebhookEvent(
        Buffer.from('{}'),
        'sig_header',
      );

      expect(result).toEqual({
        id: 'evt_3',
        type: 'checkout.session.expired',
        shipmentOrderId: 'order-1',
        externalReferenceId: null,
        status: 'unpaid',
      });
    });

    it('maps any other event type with a null shipment_order_id (caller ignores it)', () => {
      constructEvent.mockReturnValue({
        id: 'evt_2',
        type: 'payment_intent.created',
        data: { object: {} },
      });

      const result = gateway.constructWebhookEvent(
        Buffer.from('{}'),
        'sig_header',
      );

      expect(result.shipmentOrderId).toBeNull();
    });

    it('propagates the error thrown on an invalid signature', () => {
      constructEvent.mockImplementation(() => {
        throw new Error('signature verification failed');
      });

      expect(() =>
        gateway.constructWebhookEvent(Buffer.from('{}'), 'bad-sig'),
      ).toThrow('signature verification failed');
    });
  });
});
