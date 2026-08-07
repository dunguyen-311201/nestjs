import {
  ConflictException,
  Injectable,
  NotFoundException,
  UnprocessableEntityException,
} from '@nestjs/common';
import { randomUUID } from 'node:crypto';
import { NATS_SUBJECTS, ParcelOutForDeliveryEventV1 } from '@app/contracts';
import { IDispatcherRepository } from './ports/dispatcher-repository.port';
import { ICourierLookupPort } from './ports/courier-lookup.port';
import { IOrderLookupPort } from './ports/order-lookup.port';
import { IIdempotencyStore } from './ports/idempotency-store.port';
import { AssignTripDto } from './dto/assign-trip.dto';
import { AssignLegDto } from './dto/assign-leg.dto';

const IDEMPOTENCY_TTL_SECONDS = 24 * 60 * 60;

export interface AssignmentResult {
  status: 'recorded';
}

@Injectable()
export class DispatcherService {
  constructor(
    private readonly dispatcherRepository: IDispatcherRepository,
    private readonly courierLookup: ICourierLookupPort,
    private readonly orderLookup: IOrderLookupPort,
    private readonly idempotencyStore: IIdempotencyStore,
  ) {}

  async assignTrip(
    tripId: string,
    dto: AssignTripDto,
    idempotencyKey: string,
  ): Promise<AssignmentResult> {
    const cacheKey = `idem:dispatcher:${idempotencyKey}`;
    const cached = await this.idempotencyStore.get<AssignmentResult>(cacheKey);
    if (cached) {
      return cached;
    }

    const [trip, driver, truck] = await Promise.all([
      this.dispatcherRepository.findTripById(tripId),
      this.dispatcherRepository.findDriverById(dto.driver_id),
      this.dispatcherRepository.findTruckById(dto.truck_id),
    ]);

    if (!trip) {
      throw new NotFoundException(`No trip found for id ${tripId}`);
    }
    if (!driver) {
      throw new NotFoundException(`No driver found for id ${dto.driver_id}`);
    }
    if (!truck) {
      throw new NotFoundException(`No truck found for id ${dto.truck_id}`);
    }

    const overlappingTrip =
      await this.dispatcherRepository.findOverlappingActiveTrip(
        dto.driver_id,
        dto.truck_id,
        tripId,
      );
    if (overlappingTrip) {
      throw new ConflictException(
        'driver or truck already assigned to an overlapping active trip',
      );
    }

    await this.dispatcherRepository.assignDriverAndTruck(
      tripId,
      dto.driver_id,
      dto.truck_id,
    );

    const result: AssignmentResult = { status: 'recorded' };
    await this.idempotencyStore.set(cacheKey, result, IDEMPOTENCY_TTL_SECONDS);
    return result;
  }

  async assignLeg(
    parcelId: string,
    dto: AssignLegDto,
    idempotencyKey: string,
  ): Promise<AssignmentResult> {
    const cacheKey = `idem:dispatcher:${idempotencyKey}`;
    const cached = await this.idempotencyStore.get<AssignmentResult>(cacheKey);
    if (cached) {
      return cached;
    }

    const [parcel, courier] = await Promise.all([
      this.orderLookup.findParcelById(parcelId),
      this.courierLookup.findCourierById(dto.courier_id),
    ]);

    if (!parcel) {
      throw new NotFoundException(`No leg found for id ${parcelId}`);
    }
    if (!courier) {
      throw new NotFoundException(`No courier found for id ${dto.courier_id}`);
    }

    const isActiveOrVerified =
      courier.status === 'Active' || courier.status === 'Verified';
    if (!isActiveOrVerified) {
      throw new UnprocessableEntityException('courier not active/verified');
    }

    // No LEG/assignment row to persist (task 6.5, confirmed with user) -
    // but assigning a courier to the final leg is the moment a parcel
    // becomes ready for last-mile dispatch, so this does publish
    // parcel.out_for_delivery (closes a real gap found while writing the
    // e2e walkthrough: nothing published this event anywhere, so
    // PARCEL.state could never leave InHub).
    const payload: ParcelOutForDeliveryEventV1 = {
      event_id: randomUUID(),
      occurred_at: new Date().toISOString(),
      parcel_id: parcelId,
      courier_id: dto.courier_id,
    };
    // Re-checks the parcel's live state/assignment under a per-parcel lock
    // and writes the OUTBOX row atomically - closes the double-assign race
    // where two concurrent calls with different idempotency keys could
    // both pass validation and both publish this event with different
    // couriers (edge-case audit, 2026-08-06, gap #2).
    const outcome = await this.dispatcherRepository.reserveCourierAssignment(
      parcelId,
      {
        eventId: payload.event_id,
        eventType: NATS_SUBJECTS.PARCEL_OUT_FOR_DELIVERY,
        payload: payload as unknown as Record<string, unknown>,
      },
    );
    if (outcome === 'parcel_terminal') {
      throw new ConflictException('parcel already in a terminal state');
    }
    if (outcome === 'already_assigned') {
      throw new ConflictException('parcel already assigned to a courier');
    }

    const result: AssignmentResult = { status: 'recorded' };
    await this.idempotencyStore.set(cacheKey, result, IDEMPOTENCY_TTL_SECONDS);
    return result;
  }
}
