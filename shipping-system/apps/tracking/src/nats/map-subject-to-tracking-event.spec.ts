import { NATS_SUBJECTS } from '@app/contracts';
import { mapSubjectToTrackingEvent } from './map-subject-to-tracking-event';
import { TrackingEventType } from '../entities/tracking-event.entity';

describe('mapSubjectToTrackingEvent', () => {
  it('maps parcel.picked_up to a PICKUP row', () => {
    const result = mapSubjectToTrackingEvent(NATS_SUBJECTS.PARCEL_PICKED_UP, {
      event_id: 'evt-1',
      parcel_id: 'parcel-1',
      courier_id: 'courier-1',
    });

    expect(result).toEqual({
      eventId: 'evt-1',
      parcelId: 'parcel-1',
      hubId: null,
      courierId: 'courier-1',
      linehaulTripId: null,
      eventType: TrackingEventType.PICKUP,
    });
  });

  it('maps parcel.hub_received to a HUB_RECEIVE row', () => {
    const result = mapSubjectToTrackingEvent(
      NATS_SUBJECTS.PARCEL_HUB_RECEIVED,
      { event_id: 'evt-2', parcel_id: 'parcel-1', hub_id: 'hub-1' },
    );

    expect(result?.eventType).toBe(TrackingEventType.HUB_RECEIVE);
    expect(result?.hubId).toBe('hub-1');
  });

  it('maps parcel.loaded_for_linehaul to a DEPARTED_LINEHAUL row', () => {
    const result = mapSubjectToTrackingEvent(
      NATS_SUBJECTS.PARCEL_LOADED_FOR_LINEHAUL,
      { event_id: 'evt-3', parcel_id: 'parcel-1', linehaul_trip_id: 'trip-1' },
    );

    expect(result?.eventType).toBe(TrackingEventType.DEPARTED_LINEHAUL);
    expect(result?.linehaulTripId).toBe('trip-1');
  });

  it('maps parcel.arrived_at_hub to an ARRIVED_AT_HUB row', () => {
    const result = mapSubjectToTrackingEvent(
      NATS_SUBJECTS.PARCEL_ARRIVED_AT_HUB,
      {
        event_id: 'evt-4',
        parcel_id: 'parcel-1',
        hub_id: 'hub-2',
        linehaul_trip_id: 'trip-1',
      },
    );

    expect(result?.eventType).toBe(TrackingEventType.ARRIVED_AT_HUB);
    expect(result?.hubId).toBe('hub-2');
    expect(result?.linehaulTripId).toBe('trip-1');
  });

  it('maps parcel.out_for_delivery to an OUT_FOR_DELIVERY row', () => {
    const result = mapSubjectToTrackingEvent(
      NATS_SUBJECTS.PARCEL_OUT_FOR_DELIVERY,
      { event_id: 'evt-5', parcel_id: 'parcel-1', courier_id: 'courier-1' },
    );

    expect(result?.eventType).toBe(TrackingEventType.OUT_FOR_DELIVERY);
  });

  it('maps parcel.delivered to a DELIVERED row', () => {
    const result = mapSubjectToTrackingEvent(NATS_SUBJECTS.PARCEL_DELIVERED, {
      event_id: 'evt-6',
      parcel_id: 'parcel-1',
      courier_id: 'courier-1',
    });

    expect(result?.eventType).toBe(TrackingEventType.DELIVERED);
  });

  it('maps parcel.misrouted to a MISROUTED row using scanned_hub_id', () => {
    const result = mapSubjectToTrackingEvent(NATS_SUBJECTS.PARCEL_MISROUTED, {
      event_id: 'evt-7',
      parcel_id: 'parcel-1',
      scanned_hub_id: 'hub-3',
    });

    expect(result?.eventType).toBe(TrackingEventType.MISROUTED);
    expect(result?.hubId).toBe('hub-3');
  });

  it('maps parcel.rts to an RTS row', () => {
    const result = mapSubjectToTrackingEvent(NATS_SUBJECTS.PARCEL_RTS, {
      event_id: 'evt-8',
      parcel_id: 'parcel-1',
    });

    expect(result?.eventType).toBe(TrackingEventType.RTS);
  });

  it('returns null for an unrecognized subject (e.g. trip.departed)', () => {
    const result = mapSubjectToTrackingEvent(NATS_SUBJECTS.TRIP_DEPARTED, {
      event_id: 'evt-9',
      parcel_id: 'parcel-1',
    });

    expect(result).toBeNull();
  });

  it('returns null when the payload is missing parcel_id', () => {
    const result = mapSubjectToTrackingEvent(NATS_SUBJECTS.PARCEL_PICKED_UP, {
      event_id: 'evt-10',
    });

    expect(result).toBeNull();
  });

  it('returns null when the payload is missing event_id', () => {
    const result = mapSubjectToTrackingEvent(NATS_SUBJECTS.PARCEL_PICKED_UP, {
      parcel_id: 'parcel-1',
    });

    expect(result).toBeNull();
  });
});
