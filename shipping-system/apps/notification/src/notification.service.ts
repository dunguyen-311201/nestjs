import { Injectable, Logger } from '@nestjs/common';
import { IEmailProvider } from './ports/email-provider.port';
import { IIdempotencyStore } from './ports/idempotency-store.port';
import {
  OrderCreatedEventV1,
  PaymentSucceededEventV1,
  ParcelDeliveredEventV1,
  ParcelRtsEventV1,
  ParcelLostSuspectedEventV1,
} from '@app/contracts';

const IDEMPOTENCY_TTL_SECONDS = 24 * 60 * 60;

@Injectable()
export class NotificationService {
  private readonly logger = new Logger(NotificationService.name);

  constructor(
    private readonly emailProvider: IEmailProvider,
    private readonly idempotencyStore: IIdempotencyStore,
  ) {}

  async handleOrderCreated(event: OrderCreatedEventV1): Promise<void> {
    const subject = `Order Created: ${event.order_id}`;
    const body = `Your order ${event.order_id} has been successfully created with ${event.parcel_ids.length} parcels.`;
    await this.sendNotification(event.event_id, event.order_id, subject, body);
  }

  async handlePaymentSucceeded(event: PaymentSucceededEventV1): Promise<void> {
    const subject = `Payment Succeeded: ${event.order_id}`;
    const body = `Your payment for order ${event.order_id} (Payment ID: ${event.payment_id}) has succeeded.`;
    await this.sendNotification(event.event_id, event.order_id, subject, body);
  }

  async handleParcelDelivered(event: ParcelDeliveredEventV1): Promise<void> {
    const subject = `Parcel Delivered: ${event.parcel_id}`;
    const body = `Your parcel ${event.parcel_id} has been delivered by courier ${event.courier_id}.`;
    await this.sendNotification(event.event_id, event.parcel_id, subject, body);
  }

  async handleParcelRts(event: ParcelRtsEventV1): Promise<void> {
    const subject = `Parcel Return to Sender (RTS): ${event.parcel_id}`;
    const body = `Your parcel ${event.parcel_id} is being returned to the sender.`;
    await this.sendNotification(event.event_id, event.parcel_id, subject, body);
  }

  async handleParcelLostSuspected(
    event: ParcelLostSuspectedEventV1,
  ): Promise<void> {
    const subject = `Parcel Lost Suspected: ${event.parcel_id}`;
    const body = `Your parcel ${event.parcel_id} is suspected to be lost. Last scan type was ${event.last_scan_type} at ${event.last_scan_at}.`;
    await this.sendNotification(event.event_id, event.parcel_id, subject, body);
  }

  private async sendNotification(
    eventId: string,
    referenceId: string,
    subject: string,
    body: string,
  ): Promise<void> {
    const dedupKey = `idem:notification:${eventId}`;
    // Unlike Dispatcher/Courier/Line-haul's IIdempotencyStore usage (request
    // replay), this dedups a NATS redelivery of the same event_id - without
    // it, a redelivered order.created/etc. sends a duplicate customer email
    // (edge-case audit, 2026-08-06, gap #3). The key is only set after a
    // successful send, so a genuine send failure still gets retried on the
    // next redelivery, matching BR-09's "never blocks, best-effort" intent.
    const alreadySent = await this.idempotencyStore.get<boolean>(dedupKey);
    if (alreadySent) {
      this.logger.log(`Skipping duplicate notification for ${referenceId}`);
      return;
    }

    try {
      await this.emailProvider.send(referenceId, subject, body);
      await this.idempotencyStore.set(dedupKey, true, IDEMPOTENCY_TTL_SECONDS);
    } catch (error) {
      this.logger.error(
        `Failed to send notification for ${referenceId}: ${(error as Error).message}`,
      );
    }
  }
}
