import { NATS_SUBJECTS } from '@app/contracts';
import { mapSubjectToEventType } from './map-subject-to-event-type';
import { TrackingEventType } from './parcel-state-machine';

describe('mapSubjectToEventType', () => {
  it.each([
    [NATS_SUBJECTS.PARCEL_PICKED_UP, TrackingEventType.PICKUP],
    [NATS_SUBJECTS.PARCEL_HUB_RECEIVED, TrackingEventType.HUB_RECEIVE],
    [
      NATS_SUBJECTS.PARCEL_LOADED_FOR_LINEHAUL,
      TrackingEventType.DEPARTED_LINEHAUL,
    ],
    [NATS_SUBJECTS.PARCEL_ARRIVED_AT_HUB, TrackingEventType.ARRIVED_AT_HUB],
    [NATS_SUBJECTS.PARCEL_OUT_FOR_DELIVERY, TrackingEventType.OUT_FOR_DELIVERY],
    [NATS_SUBJECTS.PARCEL_DELIVERED, TrackingEventType.DELIVERED],
    [NATS_SUBJECTS.PARCEL_MISROUTED, TrackingEventType.MISROUTED],
    [NATS_SUBJECTS.PARCEL_RTS, TrackingEventType.RTS],
  ])('maps %s to %s', (subject, expected) => {
    expect(mapSubjectToEventType(subject)).toBe(expected);
  });

  it('returns null for an unrecognized subject (e.g. trip.departed)', () => {
    expect(mapSubjectToEventType(NATS_SUBJECTS.TRIP_DEPARTED)).toBeNull();
  });
});
