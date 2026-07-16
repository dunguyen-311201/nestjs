import {
  TrackingEvent,
  TrackingEventType,
} from '../entities/tracking-event.entity';

export interface NewTrackingEvent {
  eventId: string;
  parcelId: string;
  hubId?: string | null;
  courierId?: string | null;
  linehaulTripId?: string | null;
  eventType: TrackingEventType;
}

export abstract class ITrackingEventRepository {
  // Idempotent on eventId (append-only store + consumer-side dedup): a
  // redelivered event is a no-op, never a second row.
  abstract appendEvent(data: NewTrackingEvent): Promise<void>;

  abstract findTimelineByParcelIds(
    parcelIds: string[],
  ): Promise<TrackingEvent[]>;
}
