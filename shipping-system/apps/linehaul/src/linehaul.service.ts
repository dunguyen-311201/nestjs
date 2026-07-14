import {
  BadRequestException,
  ConflictException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { randomUUID } from 'node:crypto';
import {
  NATS_SUBJECTS,
  TripArrivedEventV1,
  TripDepartedEventV1,
} from '@app/contracts';
import { ILinehaulRepository } from './ports/linehaul-repository.port';
import { IIdempotencyStore } from './ports/idempotency-store.port';
import { CreateTripDto } from './dto/create-trip.dto';
import { LinehaulTripStatus } from './entities/linehaul-trip-status.enum';

const IDEMPOTENCY_TTL_SECONDS = 24 * 60 * 60;

export interface CreateTripResult {
  trip_id: string;
}

export interface TripActionResult {
  status: 'recorded';
}

@Injectable()
export class LinehaulService {
  constructor(
    private readonly linehaulRepository: ILinehaulRepository,
    private readonly idempotencyStore: IIdempotencyStore,
  ) {}

  async createTrip(
    dto: CreateTripDto,
    idempotencyKey: string,
  ): Promise<CreateTripResult> {
    const cacheKey = `idem:linehaul:${idempotencyKey}`;
    const cached = await this.idempotencyStore.get<CreateTripResult>(cacheKey);
    if (cached) {
      return cached;
    }

    if (dto.origin_hub_id === dto.dest_hub_id) {
      throw new BadRequestException(
        'origin_hub_id must be different from dest_hub_id',
      );
    }

    const [originHub, destHub] = await Promise.all([
      this.linehaulRepository.findHubById(dto.origin_hub_id),
      this.linehaulRepository.findHubById(dto.dest_hub_id),
    ]);
    if (!originHub) {
      throw new NotFoundException(`No hub found for id ${dto.origin_hub_id}`);
    }
    if (!destHub) {
      throw new NotFoundException(`No hub found for id ${dto.dest_hub_id}`);
    }

    const trip = await this.linehaulRepository.createTrip(
      dto.origin_hub_id,
      dto.dest_hub_id,
    );

    const result: CreateTripResult = { trip_id: trip.id };
    await this.idempotencyStore.set(cacheKey, result, IDEMPOTENCY_TTL_SECONDS);
    return result;
  }

  async depart(
    tripId: string,
    idempotencyKey: string,
  ): Promise<TripActionResult> {
    const cacheKey = `idem:linehaul:${idempotencyKey}`;
    const cached = await this.idempotencyStore.get<TripActionResult>(cacheKey);
    if (cached) {
      return cached;
    }

    const trip = await this.linehaulRepository.findTripById(tripId);
    if (!trip) {
      throw new NotFoundException(`No trip found for id ${tripId}`);
    }
    if (trip.status !== LinehaulTripStatus.CREATED) {
      throw new ConflictException(
        `Trip ${tripId} is already ${trip.status} - cannot depart`,
      );
    }

    const payload: TripDepartedEventV1 = {
      event_id: randomUUID(),
      occurred_at: new Date().toISOString(),
      linehaul_trip_id: tripId,
      origin_hub_id: trip.originHubId,
    };
    await this.linehaulRepository.markDeparted(tripId, {
      eventId: payload.event_id,
      eventType: NATS_SUBJECTS.TRIP_DEPARTED,
      payload: payload as unknown as Record<string, unknown>,
    });

    const result: TripActionResult = { status: 'recorded' };
    await this.idempotencyStore.set(cacheKey, result, IDEMPOTENCY_TTL_SECONDS);
    return result;
  }

  async arrive(
    tripId: string,
    idempotencyKey: string,
  ): Promise<TripActionResult> {
    const cacheKey = `idem:linehaul:${idempotencyKey}`;
    const cached = await this.idempotencyStore.get<TripActionResult>(cacheKey);
    if (cached) {
      return cached;
    }

    const trip = await this.linehaulRepository.findTripById(tripId);
    if (!trip) {
      throw new NotFoundException(`No trip found for id ${tripId}`);
    }
    if (trip.status !== LinehaulTripStatus.DEPARTED) {
      throw new ConflictException(
        `Trip ${tripId} is ${trip.status} - must be Departed before it can arrive`,
      );
    }

    const payload: TripArrivedEventV1 = {
      event_id: randomUUID(),
      occurred_at: new Date().toISOString(),
      linehaul_trip_id: tripId,
      dest_hub_id: trip.destHubId,
    };
    await this.linehaulRepository.markArrived(tripId, {
      eventId: payload.event_id,
      eventType: NATS_SUBJECTS.TRIP_ARRIVED,
      payload: payload as unknown as Record<string, unknown>,
    });

    const result: TripActionResult = { status: 'recorded' };
    await this.idempotencyStore.set(cacheKey, result, IDEMPOTENCY_TTL_SECONDS);
    return result;
  }
}
