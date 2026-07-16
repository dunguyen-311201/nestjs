import {
  ConflictException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { BusinessRuleException } from '@app/dtos';
import { NATS_SUBJECTS, PaymentSucceededEventV1 } from '@app/contracts';
import { IOrderRepository } from './ports/order-repository.port';
import { IPaymentRepository } from './ports/payment-repository.port';
import { IPaymentGateway } from './ports/payment-gateway.port';
import { IEventPublisher } from './ports/event-publisher.port';
import { ShipmentOrderStatus } from './entities/shipment-order-status.enum';
import { PaymentStatus } from './entities/payment-status.enum';

export interface CheckoutResult {
  checkout_url: string;
  stripe_session_id: string;
}

@Injectable()
export class PaymentService {
  constructor(
    private readonly orderRepository: IOrderRepository,
    private readonly paymentRepository: IPaymentRepository,
    private readonly paymentGateway: IPaymentGateway,
    private readonly eventPublisher: IEventPublisher,
  ) {}

  async checkout(shipmentOrderId: string): Promise<CheckoutResult> {
    const order = await this.orderRepository.findById(shipmentOrderId);
    if (!order) {
      throw new NotFoundException(
        `No shipment order found for id ${shipmentOrderId}`,
      );
    }
    if (order.status === ShipmentOrderStatus.CONFIRMED) {
      throw new ConflictException('Order is already Confirmed');
    }

    const payment =
      await this.paymentRepository.findByShipmentOrderId(shipmentOrderId);
    if (payment && payment.status !== PaymentStatus.UNPAID) {
      throw new BusinessRuleException(
        'BR-08',
        'Order already has a payment in progress or completed',
      );
    }

    const session = await this.paymentGateway.createCheckoutSession(
      shipmentOrderId,
      order.priceCents,
    );

    return {
      checkout_url: session.checkoutUrl,
      stripe_session_id: session.sessionId,
    };
  }

  async handleWebhookEvent(rawBody: Buffer, signature: string): Promise<void> {
    const event = this.paymentGateway.constructWebhookEvent(rawBody, signature);

    // Stripe requires a 200 ack for event types this handler doesn't act
    // on, so it doesn't retry a webhook endpoint it would otherwise think
    // is broken - not every event this endpoint receives is a payment
    // confirmation.
    if (event.type !== 'checkout.session.completed' || !event.shipmentOrderId) {
      return;
    }

    const result = await this.paymentRepository.confirmPayment({
      shipmentOrderId: event.shipmentOrderId,
      provider: 'STRIPE',
      externalTransactionId: event.id,
      externalReferenceId: event.externalReferenceId,
      status: event.status,
    });

    if (result === 'duplicate') {
      return;
    }

    const payment = await this.paymentRepository.findByShipmentOrderId(
      event.shipmentOrderId,
    );

    // No outbox here (accepted MVP risk): SHIPMENT_ORDER.status is already
    // correct even if this publish is lost, so the blast radius is smaller
    // than the outbox-backed order.created case.
    const payload: PaymentSucceededEventV1 = {
      event_id: event.id,
      occurred_at: new Date().toISOString(),
      order_id: event.shipmentOrderId,
      payment_id: payment?.id as string,
    };
    await this.eventPublisher.publish(
      NATS_SUBJECTS.PAYMENT_SUCCEEDED,
      event.id,
      payload as unknown as Record<string, unknown>,
    );
  }
}
