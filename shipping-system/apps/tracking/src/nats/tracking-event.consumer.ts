import { Controller, Logger } from '@nestjs/common';
import { EventPattern } from '@nestjs/microservices';
import { NATS_SUBJECTS } from '@app/contracts';
import { ITrackingEventRepository } from '../ports/tracking-event-repository.port';
import { IOrderLookupPort } from '../ports/order-lookup.port';
import { IStatusTriggerPublisher } from '../ports/status-trigger-publisher.port';
import { mapSubjectToTrackingEvent } from './map-subject-to-tracking-event';
import type { ParcelLifecyclePayload } from './map-subject-to-tracking-event';

// Parcel-lifecycle events stay on @nestjs/microservices' NATS-core
// transport. Only the per-order recompute trigger it publishes after each
// TRACKING_EVENT row goes over real JetStream via statusTriggerPublisher,
// since the built-in transporter can't speak JetStream.
@Controller()
export class TrackingEventConsumer {
  private readonly logger = new Logger(TrackingEventConsumer.name);

  constructor(
    private readonly trackingEventRepository: ITrackingEventRepository,
    private readonly orderLookupPort: IOrderLookupPort,
    private readonly statusTriggerPublisher: IStatusTriggerPublisher,
  ) {}

  @EventPattern(NATS_SUBJECTS.PARCEL_PICKED_UP)
  onPickedUp(payload: ParcelLifecyclePayload): Promise<void> {
    return this.handle(NATS_SUBJECTS.PARCEL_PICKED_UP, payload);
  }

  @EventPattern(NATS_SUBJECTS.PARCEL_HUB_RECEIVED)
  onHubReceived(payload: ParcelLifecyclePayload): Promise<void> {
    return this.handle(NATS_SUBJECTS.PARCEL_HUB_RECEIVED, payload);
  }

  @EventPattern(NATS_SUBJECTS.PARCEL_LOADED_FOR_LINEHAUL)
  onLoadedForLinehaul(payload: ParcelLifecyclePayload): Promise<void> {
    return this.handle(NATS_SUBJECTS.PARCEL_LOADED_FOR_LINEHAUL, payload);
  }

  @EventPattern(NATS_SUBJECTS.PARCEL_ARRIVED_AT_HUB)
  onArrivedAtHub(payload: ParcelLifecyclePayload): Promise<void> {
    return this.handle(NATS_SUBJECTS.PARCEL_ARRIVED_AT_HUB, payload);
  }

  @EventPattern(NATS_SUBJECTS.PARCEL_OUT_FOR_DELIVERY)
  onOutForDelivery(payload: ParcelLifecyclePayload): Promise<void> {
    return this.handle(NATS_SUBJECTS.PARCEL_OUT_FOR_DELIVERY, payload);
  }

  @EventPattern(NATS_SUBJECTS.PARCEL_DELIVERY_FAILED)
  onDeliveryFailed(payload: ParcelLifecyclePayload): Promise<void> {
    return this.handle(NATS_SUBJECTS.PARCEL_DELIVERY_FAILED, payload);
  }

  @EventPattern(NATS_SUBJECTS.PARCEL_DELIVERED)
  onDelivered(payload: ParcelLifecyclePayload): Promise<void> {
    return this.handle(NATS_SUBJECTS.PARCEL_DELIVERED, payload);
  }

  @EventPattern(NATS_SUBJECTS.PARCEL_MISROUTED)
  onMisrouted(payload: ParcelLifecyclePayload): Promise<void> {
    return this.handle(NATS_SUBJECTS.PARCEL_MISROUTED, payload);
  }

  @EventPattern(NATS_SUBJECTS.PARCEL_RTS)
  onRts(payload: ParcelLifecyclePayload): Promise<void> {
    return this.handle(NATS_SUBJECTS.PARCEL_RTS, payload);
  }

  @EventPattern(NATS_SUBJECTS.PARCEL_DAMAGED)
  onDamaged(payload: ParcelLifecyclePayload): Promise<void> {
    return this.handle(NATS_SUBJECTS.PARCEL_DAMAGED, payload);
  }

  private async handle(
    subject: string,
    payload: ParcelLifecyclePayload,
  ): Promise<void> {
    const event = mapSubjectToTrackingEvent(subject, payload);
    if (!event) {
      this.logger.warn(`Unrecognized or malformed message on ${subject}`);
      return;
    }

    await this.trackingEventRepository.appendEvent(event);

    const shipmentOrderId =
      await this.orderLookupPort.findShipmentOrderIdByParcelId(event.parcelId);
    if (!shipmentOrderId) {
      this.logger.warn(
        `Could not resolve shipment_order_id for parcel ${event.parcelId}; skipping projection recompute trigger`,
      );
      return;
    }

    await this.statusTriggerPublisher.publish(shipmentOrderId);
  }
}
