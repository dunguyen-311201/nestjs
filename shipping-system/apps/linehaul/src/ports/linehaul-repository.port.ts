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
}

export abstract class ILinehaulRepository {
  abstract findHubById(hubId: string): Promise<{ id: string } | null>;

  abstract createTrip(
    originHubId: string,
    destHubId: string,
  ): Promise<{ id: string }>;

  abstract findTripById(tripId: string): Promise<TripRecord | null>;

  // Both write LINEHAULTRIP.status + an OUTBOX row atomically.
  abstract markDeparted(
    tripId: string,
    outboxEvent: OutboxEventInput,
  ): Promise<void>;
  abstract markArrived(
    tripId: string,
    outboxEvent: OutboxEventInput,
  ): Promise<void>;
}
