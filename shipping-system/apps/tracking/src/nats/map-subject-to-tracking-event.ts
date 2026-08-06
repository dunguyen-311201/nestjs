import { NATS_SUBJECTS } from '@app/contracts';
import { NewTrackingEvent } from '../ports/tracking-event-repository.port';
import { TrackingEventType } from '../entities/tracking-event.entity';

export interface ParcelLifecyclePayload {
  event_id?: string;
  parcel_id?: string;
  hub_id?: string;
  courier_id?: string;
  linehaul_trip_id?: string;
  scanned_hub_id?: string;
}

// The subjects Tracking consumes and appends as a TRACKING_EVENT row - one
// per event_type the DB's CHECK constraint accepts. trip.departed/
// trip.arrived are deliberately excluded: they carry no parcel_id (they're
// trip-level, not parcel-level events), so there's no TRACKING_EVENT row to
// write for them.
const SUBJECT_TO_EVENT_TYPE: Partial<Record<string, TrackingEventType>> = {
  [NATS_SUBJECTS.PARCEL_PICKED_UP]: TrackingEventType.PICKUP,
  [NATS_SUBJECTS.PARCEL_HUB_RECEIVED]: TrackingEventType.HUB_RECEIVE,
  [NATS_SUBJECTS.PARCEL_LOADED_FOR_LINEHAUL]:
    TrackingEventType.DEPARTED_LINEHAUL,
  [NATS_SUBJECTS.PARCEL_ARRIVED_AT_HUB]: TrackingEventType.ARRIVED_AT_HUB,
  [NATS_SUBJECTS.PARCEL_OUT_FOR_DELIVERY]: TrackingEventType.OUT_FOR_DELIVERY,
  [NATS_SUBJECTS.PARCEL_DELIVERY_FAILED]: TrackingEventType.DELIVERY_FAILED,
  [NATS_SUBJECTS.PARCEL_DELIVERED]: TrackingEventType.DELIVERED,
  [NATS_SUBJECTS.PARCEL_MISROUTED]: TrackingEventType.MISROUTED,
  [NATS_SUBJECTS.PARCEL_RTS]: TrackingEventType.RTS,
  [NATS_SUBJECTS.PARCEL_DAMAGED]: TrackingEventType.DAMAGED,
};

export const CONSUMED_SUBJECTS = Object.keys(SUBJECT_TO_EVENT_TYPE);

// Pure mapping: NATS subject + decoded JSON payload -> a row to append, or
// null if the subject is unrecognized or the payload is missing parcel_id.
// Kept separate from the NATS client wiring so it's unit-testable without
// mocking a connection.
export function mapSubjectToTrackingEvent(
  subject: string,
  payload: ParcelLifecyclePayload,
): NewTrackingEvent | null {
  const eventType = SUBJECT_TO_EVENT_TYPE[subject];
  if (!eventType || !payload?.event_id || !payload?.parcel_id) {
    return null;
  }

  return {
    eventId: payload.event_id,
    parcelId: payload.parcel_id,
    hubId: payload.hub_id ?? payload.scanned_hub_id ?? null,
    courierId: payload.courier_id ?? null,
    linehaulTripId: payload.linehaul_trip_id ?? null,
    eventType,
  };
}
