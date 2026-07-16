import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository, In } from 'typeorm';
import { TrackingEvent } from '../entities/tracking-event.entity';
import {
  ITrackingEventRepository,
  NewTrackingEvent,
} from '../ports/tracking-event-repository.port';

@Injectable()
export class TrackingEventRepository implements ITrackingEventRepository {
  constructor(
    @InjectRepository(TrackingEvent)
    private readonly repository: Repository<TrackingEvent>,
  ) {}

  async appendEvent(data: NewTrackingEvent): Promise<void> {
    // ON CONFLICT (event_id) DO NOTHING: append-only store + consumer-side
    // dedup (2nd idempotency layer) - a redelivered event is a no-op.
    await this.repository
      .createQueryBuilder()
      .insert()
      .values({
        eventId: data.eventId,
        parcelId: data.parcelId,
        hubId: data.hubId ?? null,
        courierId: data.courierId ?? null,
        linehaulTripId: data.linehaulTripId ?? null,
        eventType: data.eventType,
      })
      .orIgnore()
      .execute();
  }

  findTimelineByParcelIds(parcelIds: string[]): Promise<TrackingEvent[]> {
    return this.repository.find({
      where: { parcelId: In(parcelIds) },
      order: { createdAt: 'ASC' },
    });
  }
}
