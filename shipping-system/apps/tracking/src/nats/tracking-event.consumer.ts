import { Controller, Inject, Logger } from '@nestjs/common';
import { ClientProxy, EventPattern } from '@nestjs/microservices';
import { firstValueFrom } from 'rxjs';
import { NATS_SUBJECTS, orderStatusSubject } from '@app/contracts';
import { ITrackingEventRepository } from '../ports/tracking-event-repository.port';
import { IOrderLookupPort } from '../ports/order-lookup.port';
import { NATS_CLIENT } from './nats-client.token';
import { mapSubjectToTrackingEvent } from './map-subject-to-tracking-event';
import type { ParcelLifecyclePayload } from './map-subject-to-tracking-event';

// Built on @nestjs/microservices' NATS transport (core NATS pub/sub, not
// JetStream - per-aggregate JetStream ordering is task 5.7's job). After
// appending a TRACKING_EVENT row, also publishes the per-order recompute
// trigger (Diagram 8, docs/lld/order-service.md) so Order's projection
// consumer (task 5.6) can recompute SHIPMENT_ORDER.status.
@Controller()
export class TrackingEventConsumer {
  private readonly logger = new Logger(TrackingEventConsumer.name);

  constructor(
    private readonly trackingEventRepository: ITrackingEventRepository,
    private readonly orderLookupPort: IOrderLookupPort,
    @Inject(NATS_CLIENT) private readonly client: ClientProxy,
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

    await firstValueFrom(
      this.client.emit(orderStatusSubject(shipmentOrderId), {}),
    );
  }
}
