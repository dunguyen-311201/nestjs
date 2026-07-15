import { LinehaulTripStatus } from '../entities/linehaul-trip-status.enum';

export interface OutboxEventInput {
  eventId: string;
  eventType: string;
  payload: Record<string, unknown>;
}

export interface TripRecord {
  id: string;
  status: LinehaulTripStatus;
  originHubId: string;
  destHubId: string;
  parcelIds: string[];
}

export abstract class ILinehaulRepository {
  abstract findHubById(hubId: string): Promise<{ id: string } | null>;

  abstract createTrip(
    originHubId: string,
    destHubId: string,
    parcelIds: string[],
  ): Promise<{ id: string }>;

  abstract findTripById(tripId: string): Promise<TripRecord | null>;

  // Both write LINEHAULTRIP.status + one or more OUTBOX rows atomically.
  // markDeparted takes an array: one trip.departed event plus one
  // parcel.loaded_for_linehaul event per parcel_ids entry on the trip.
  abstract markDeparted(
    tripId: string,
    outboxEvents: OutboxEventInput[],
  ): Promise<void>;
  abstract markArrived(
    tripId: string,
    outboxEvent: OutboxEventInput,
  ): Promise<void>;
}
