/* eslint-disable @typescript-eslint/unbound-method -- jest.fn() mocks flagged as false positives */
import { ConflictException, NotFoundException } from '@nestjs/common';
import { BusinessRuleException } from '@app/dtos';
import { PaymentService } from './payment.service';
import { IOrderRepository } from './ports/order-repository.port';
import { IPaymentRepository } from './ports/payment-repository.port';
import { IPaymentGateway } from './ports/payment-gateway.port';
import { IEventPublisher } from './ports/event-publisher.port';
import { ShipmentOrderStatus } from './entities/shipment-order-status.enum';
import { PaymentStatus } from './entities/payment-status.enum';

describe('PaymentService', () => {
  let orderRepository: jest.Mocked<Pick<IOrderRepository, 'findById'>>;
  let paymentRepository: jest.Mocked<IPaymentRepository>;
  let paymentGateway: jest.Mocked<IPaymentGateway>;
  let eventPublisher: jest.Mocked<IEventPublisher>;
  let service: PaymentService;

  beforeEach(() => {
    orderRepository = { findById: jest.fn() };
    paymentRepository = {
      findByShipmentOrderId: jest.fn(),
      confirmPayment: jest.fn(),
    };
    paymentGateway = {
      createCheckoutSession: jest.fn(),
      constructWebhookEvent: jest.fn(),
    };
    eventPublisher = { publish: jest.fn().mockResolvedValue(undefined) };
    service = new PaymentService(
      orderRepository,
      paymentRepository,
      paymentGateway,
      eventPublisher,
    );
  });

  describe('checkout', () => {
    it('creates a Stripe Checkout Session for an unpaid order', async () => {
      orderRepository.findById.mockResolvedValue({
        id: 'order-1',
        status: ShipmentOrderStatus.CREATED,
        priceCents: 5000,
      } as never);
      paymentRepository.findByShipmentOrderId.mockResolvedValue({
        status: PaymentStatus.UNPAID,
      } as never);
      paymentGateway.createCheckoutSession.mockResolvedValue({
        checkoutUrl: 'https://checkout.stripe.com/cs_1',
        sessionId: 'cs_1',
      });

      const result = await service.checkout('order-1');

      expect(paymentGateway.createCheckoutSession).toHaveBeenCalledWith(
        'order-1',
        5000,
      );
      expect(result).toEqual({
        checkout_url: 'https://checkout.stripe.com/cs_1',
        stripe_session_id: 'cs_1',
      });
    });

    it('throws 404 when the order does not exist', async () => {
      orderRepository.findById.mockResolvedValue(null);

      await expect(service.checkout('missing')).rejects.toThrow(
        NotFoundException,
      );
      expect(paymentGateway.createCheckoutSession).not.toHaveBeenCalled();
    });

    it('throws 409 when the order is already Confirmed', async () => {
      orderRepository.findById.mockResolvedValue({
        id: 'order-1',
        status: ShipmentOrderStatus.CONFIRMED,
        priceCents: 5000,
      } as never);

      await expect(service.checkout('order-1')).rejects.toThrow(
        ConflictException,
      );
      expect(paymentGateway.createCheckoutSession).not.toHaveBeenCalled();
    });

    it('throws BR-08 (422) when the PAYMENT row is already in a non-Unpaid state', async () => {
      orderRepository.findById.mockResolvedValue({
        id: 'order-1',
        status: ShipmentOrderStatus.CREATED,
        priceCents: 5000,
      } as never);
      paymentRepository.findByShipmentOrderId.mockResolvedValue({
        status: PaymentStatus.PAID,
      } as never);

      await expect(service.checkout('order-1')).rejects.toMatchObject({
        rule: 'BR-08',
      });
      await expect(service.checkout('order-1')).rejects.toBeInstanceOf(
        BusinessRuleException,
      );
      expect(paymentGateway.createCheckoutSession).not.toHaveBeenCalled();
    });
  });

  describe('handleWebhookEvent', () => {
    const rawBody = Buffer.from('{}');

    it('confirms the payment and publishes payment.succeeded on a new checkout.session.completed event', async () => {
      paymentGateway.constructWebhookEvent.mockReturnValue({
        id: 'evt-1',
        type: 'checkout.session.completed',
        shipmentOrderId: 'order-1',
        externalReferenceId: 'pi_123',
        status: 'paid',
      });
      paymentRepository.confirmPayment.mockResolvedValue('confirmed');
      paymentRepository.findByShipmentOrderId.mockResolvedValue({
        id: 'payment-1',
      } as never);

      await service.handleWebhookEvent(rawBody, 'sig');

      expect(paymentRepository.confirmPayment).toHaveBeenCalledWith({
        shipmentOrderId: 'order-1',
        provider: 'STRIPE',
        externalTransactionId: 'evt-1',
        externalReferenceId: 'pi_123',
        status: 'paid',
      });
      expect(eventPublisher.publish).toHaveBeenCalledWith(
        'payment.succeeded',
        'evt-1',
        expect.objectContaining({
          order_id: 'order-1',
          payment_id: 'payment-1',
        }),
      );
    });

    it('does not publish again when the event is a duplicate', async () => {
      paymentGateway.constructWebhookEvent.mockReturnValue({
        id: 'evt-1',
        type: 'checkout.session.completed',
        shipmentOrderId: 'order-1',
        externalReferenceId: 'pi_123',
        status: 'paid',
      });
      paymentRepository.confirmPayment.mockResolvedValue('duplicate');

      await service.handleWebhookEvent(rawBody, 'sig');

      expect(eventPublisher.publish).not.toHaveBeenCalled();
    });

    it('acks (no-op) any event type other than checkout.session.completed', async () => {
      paymentGateway.constructWebhookEvent.mockReturnValue({
        id: 'evt-2',
        type: 'payment_intent.created',
        shipmentOrderId: null,
        externalReferenceId: null,
        status: 'ignored',
      });

      await service.handleWebhookEvent(rawBody, 'sig');

      expect(paymentRepository.confirmPayment).not.toHaveBeenCalled();
      expect(eventPublisher.publish).not.toHaveBeenCalled();
    });

    it('propagates the signature-verification error for the controller to map to 400', async () => {
      paymentGateway.constructWebhookEvent.mockImplementation(() => {
        throw new Error('signature verification failed');
      });

      await expect(
        service.handleWebhookEvent(rawBody, 'bad-sig'),
      ).rejects.toThrow('signature verification failed');
    });
  });
});
