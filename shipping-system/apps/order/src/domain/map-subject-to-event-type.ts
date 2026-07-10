import { NATS_SUBJECTS } from '@app/contracts';
import { TrackingEventType } from './parcel-state-machine';

// Same subject set Tracking's consumer appends to TRACKING_EVENT (see
// apps/tracking/src/nats/map-subject-to-tracking-event.ts) - Order
// independently consumes the same broadcast to update its own PARCEL.state
// via ParcelStateMachine. trip.departed/trip.arrived and DELIVERY_FAILED are
// excluded for the same reasons documented there.
const SUBJECT_TO_EVENT_TYPE: Partial<Record<string, TrackingEventType>> = {
  [NATS_SUBJECTS.PARCEL_PICKED_UP]: TrackingEventType.PICKUP,
  [NATS_SUBJECTS.PARCEL_HUB_RECEIVED]: TrackingEventType.HUB_RECEIVE,
  [NATS_SUBJECTS.PARCEL_LOADED_FOR_LINEHAUL]:
    TrackingEventType.DEPARTED_LINEHAUL,
  [NATS_SUBJECTS.PARCEL_ARRIVED_AT_HUB]: TrackingEventType.ARRIVED_AT_HUB,
  [NATS_SUBJECTS.PARCEL_OUT_FOR_DELIVERY]: TrackingEventType.OUT_FOR_DELIVERY,
  [NATS_SUBJECTS.PARCEL_DELIVERED]: TrackingEventType.DELIVERED,
  [NATS_SUBJECTS.PARCEL_MISROUTED]: TrackingEventType.MISROUTED,
  [NATS_SUBJECTS.PARCEL_RTS]: TrackingEventType.RTS,
};

export function mapSubjectToEventType(
  subject: string,
): TrackingEventType | null {
  return SUBJECT_TO_EVENT_TYPE[subject] ?? null;
}
