import { Driver } from '../entities/driver.entity';
import { Truck } from '../entities/truck.entity';
import { LinehaulTrip } from '../entities/linehaul-trip.entity';
import { OutboxEventInput } from './outbox-repository.port';

export type CourierAssignmentOutcome =
  'assigned' | 'parcel_terminal' | 'already_assigned';

export abstract class IDispatcherRepository {
  abstract findTripById(id: string): Promise<LinehaulTrip | null>;
  abstract findDriverById(id: string): Promise<Driver | null>;
  abstract findTruckById(id: string): Promise<Truck | null>;
  abstract findOverlappingActiveTrip(
    driverId: string,
    truckId: string,
    excludeTripId: string,
  ): Promise<LinehaulTrip | null>;
  abstract assignDriverAndTruck(
    tripId: string,
    driverId: string,
    truckId: string,
  ): Promise<void>;
  // Guards against the double-assign race (two concurrent assign calls for
  // the same parcel, different idempotency keys): takes a per-parcel
  // Postgres advisory lock, re-checks the parcel's live state/assignment
  // (cross-schema read - shipping_order_db and shipping_network_db are
  // schemas of the same physical database, ADR-003) and writes the OUTBOX
  // row in the same transaction, so only one concurrent caller can win.
  abstract reserveCourierAssignment(
    parcelId: string,
    outboxEvent: OutboxEventInput,
  ): Promise<CourierAssignmentOutcome>;
}
