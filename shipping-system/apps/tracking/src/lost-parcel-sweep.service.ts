import { Injectable, Logger } from '@nestjs/common';
import { Cron, CronExpression } from '@nestjs/schedule';
import { randomUUID } from 'crypto';
import { NATS_SUBJECTS, ParcelLostSuspectedEventV1 } from '@app/contracts';
import { IOrderLookupPort } from './ports/order-lookup.port';
import { ITrackingEventRepository } from './ports/tracking-event-repository.port';
import { IEventPublisher } from './ports/event-publisher.port';
import { TrackingEventType } from './entities/tracking-event.entity';

// UC-15 passive lost-parcel detection: parcels are never actively counted
// (bags/manifests are out of scope, CLAUDE.md), so this sweep is the only
// signal that surfaces a stalled parcel - one that breached its order's
// expected_delivery_at with no scan past DEPARTED_LINEHAUL/OUT_FOR_DELIVERY.
@Injectable()
export class LostParcelSweepService {
  private readonly logger = new Logger(LostParcelSweepService.name);

  private static readonly IN_TRANSIT_EVENT_TYPES: TrackingEventType[] = [
    TrackingEventType.DEPARTED_LINEHAUL,
    TrackingEventType.OUT_FOR_DELIVERY,
  ];

  constructor(
    private readonly orderLookupPort: IOrderLookupPort,
    private readonly trackingEventRepository: ITrackingEventRepository,
    private readonly eventPublisher: IEventPublisher,
  ) {}

  @Cron(process.env.LOST_PARCEL_SWEEP_CRON ?? CronExpression.EVERY_HOUR)
  async sweep(): Promise<void> {
    const candidateParcelIds =
      await this.orderLookupPort.findSlaBreachedParcelIds(new Date());
    if (candidateParcelIds.length === 0) {
      return;
    }

    const timeline =
      await this.trackingEventRepository.findTimelineByParcelIds(
        candidateParcelIds,
      );

    const lastEventByParcelId = new Map<
      string,
      { eventType: TrackingEventType; createdAt: Date }
    >();
    for (const event of timeline) {
      lastEventByParcelId.set(event.parcelId, {
        eventType: event.eventType,
        createdAt: event.createdAt,
      });
    }

    for (const parcelId of candidateParcelIds) {
      const lastEvent = lastEventByParcelId.get(parcelId);
      if (
        !lastEvent ||
        !LostParcelSweepService.IN_TRANSIT_EVENT_TYPES.includes(
          lastEvent.eventType,
        )
      ) {
        continue;
      }

      const payload: ParcelLostSuspectedEventV1 = {
        event_id: randomUUID(),
        occurred_at: new Date().toISOString(),
        parcel_id: parcelId,
        last_scan_type: lastEvent.eventType,
        last_scan_at: lastEvent.createdAt.toISOString(),
      };
      this.logger.warn(
        `SLA breached with no further scan for parcel ${parcelId} (last: ${lastEvent.eventType} at ${payload.last_scan_at}) - publishing parcel.lost_suspected`,
      );
      await this.eventPublisher.publish(
        NATS_SUBJECTS.PARCEL_LOST_SUSPECTED,
        payload.event_id,
        payload as unknown as Record<string, unknown>,
      );
    }
  }
}
