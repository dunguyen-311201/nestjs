import { Controller } from '@nestjs/common';
import { EventPattern } from '@nestjs/microservices';
import { NATS_SUBJECTS } from '@app/contracts';
import { NotificationService } from './notification.service';
import type {
  OrderCreatedEventV1,
  PaymentSucceededEventV1,
  ParcelDeliveredEventV1,
  ParcelRtsEventV1,
  ParcelLostSuspectedEventV1,
} from '@app/contracts';

@Controller()
export class NotificationConsumer {
  constructor(private readonly notificationService: NotificationService) {}

  @EventPattern(NATS_SUBJECTS.ORDER_CREATED)
  async onOrderCreated(payload: OrderCreatedEventV1): Promise<void> {
    await this.notificationService.handleOrderCreated(payload);
  }

  @EventPattern(NATS_SUBJECTS.PAYMENT_SUCCEEDED)
  async onPaymentSucceeded(payload: PaymentSucceededEventV1): Promise<void> {
    await this.notificationService.handlePaymentSucceeded(payload);
  }

  @EventPattern(NATS_SUBJECTS.PARCEL_DELIVERED)
  async onParcelDelivered(payload: ParcelDeliveredEventV1): Promise<void> {
    await this.notificationService.handleParcelDelivered(payload);
  }

  @EventPattern(NATS_SUBJECTS.PARCEL_RTS)
  async onParcelRts(payload: ParcelRtsEventV1): Promise<void> {
    await this.notificationService.handleParcelRts(payload);
  }

  @EventPattern(NATS_SUBJECTS.PARCEL_LOST_SUSPECTED)
  async onParcelLostSuspected(
    payload: ParcelLostSuspectedEventV1,
  ): Promise<void> {
    await this.notificationService.handleParcelLostSuspected(payload);
  }
}
