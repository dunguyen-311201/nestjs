import { Injectable, NotFoundException } from '@nestjs/common';
import { randomUUID } from 'node:crypto';
import { BusinessRuleException } from '@app/dtos';
import {
  NATS_SUBJECTS,
  ParcelDeliveredEventV1,
  ParcelDeliveryFailedEventV1,
  ParcelPickedUpEventV1,
  ParcelRtsEventV1,
} from '@app/contracts';
import { IOrderLookupPort } from './ports/order-lookup.port';
import { ICourierRepository } from './ports/courier-repository.port';
import { IEventPublisher } from './ports/event-publisher.port';
import { IIdempotencyStore } from './ports/idempotency-store.port';
import { PickupDto } from './dto/pickup.dto';
import { DeliverDto, DeliveryOutcome } from './dto/deliver.dto';

const IDEMPOTENCY_TTL_SECONDS = 24 * 60 * 60;

export interface PickupResult {
  event: 'parcel.picked_up';
  event_id: string;
  published_at: string;
}

export interface DeliverSuccessResult {
  event: 'parcel.delivered';
  event_id: string;
  published_at: string;
  proof_of_delivery_id: string;
}

export interface DeliverFailureResult {
  delivery_attempt_id: string;
  attempt_number: number;
  rts?: {
    event: 'parcel.rts';
    event_id: string;
    published_at: string;
  };
}

export type DeliverResult = DeliverSuccessResult | DeliverFailureResult;

@Injectable()
export class CourierService {
  constructor(
    private readonly orderLookup: IOrderLookupPort,
    private readonly courierRepository: ICourierRepository,
    private readonly eventPublisher: IEventPublisher,
    private readonly idempotencyStore: IIdempotencyStore,
  ) {}

  async pickup(
    parcelId: string,
    dto: PickupDto,
    idempotencyKey: string,
  ): Promise<PickupResult> {
    const cacheKey = `idem:courier:${idempotencyKey}`;
    const cached = await this.idempotencyStore.get<PickupResult>(cacheKey);
    if (cached) {
      return cached;
    }

    const context = await this.orderLookup.findParcelOrderContext(parcelId);
    if (!context) {
      throw new NotFoundException(`No parcel found for id ${parcelId}`);
    }
    if (!CONFIRMED_OR_LATER.has(context.orderStatus)) {
      throw new BusinessRuleException(
        'BR-08',
        'Parent order is not yet Confirmed - pickup is blocked until payment is confirmed',
      );
    }

    const eventId = randomUUID();
    const occurredAt = new Date().toISOString();
    const payload: ParcelPickedUpEventV1 = {
      event_id: eventId,
      occurred_at: occurredAt,
      parcel_id: parcelId,
      courier_id: dto.courier_id,
    };
    await this.eventPublisher.publish(
      NATS_SUBJECTS.PARCEL_PICKED_UP,
      eventId,
      payload as unknown as Record<string, unknown>,
    );

    const result: PickupResult = {
      event: 'parcel.picked_up',
      event_id: eventId,
      published_at: occurredAt,
    };
    await this.idempotencyStore.set(cacheKey, result, IDEMPOTENCY_TTL_SECONDS);
    return result;
  }

  async deliver(
    parcelId: string,
    dto: DeliverDto,
    idempotencyKey: string,
  ): Promise<DeliverResult> {
    const cacheKey = `idem:courier:${idempotencyKey}`;
    const cached = await this.idempotencyStore.get<DeliverResult>(cacheKey);
    if (cached) {
      return cached;
    }

    const context = await this.orderLookup.findParcelOrderContext(parcelId);
    if (!context) {
      throw new NotFoundException(`No parcel found for id ${parcelId}`);
    }

    const result =
      dto.outcome === DeliveryOutcome.DELIVERED
        ? await this.recordSuccess(parcelId, dto)
        : await this.recordFailure(parcelId, context.parcelDirection, dto);

    await this.idempotencyStore.set(cacheKey, result, IDEMPOTENCY_TTL_SECONDS);
    return result;
  }

  private async recordSuccess(
    parcelId: string,
    dto: DeliverDto,
  ): Promise<DeliverSuccessResult> {
    const { proofOfDeliveryId } =
      await this.courierRepository.recordDeliverySuccess(
        parcelId,
        dto.signature_url ?? null,
        dto.photo_url ?? null,
      );

    const eventId = randomUUID();
    const occurredAt = new Date().toISOString();
    const payload: ParcelDeliveredEventV1 = {
      event_id: eventId,
      occurred_at: occurredAt,
      parcel_id: parcelId,
      courier_id: dto.courier_id,
      signature_url: dto.signature_url ?? null,
      photo_url: dto.photo_url ?? null,
    };
    await this.eventPublisher.publish(
      NATS_SUBJECTS.PARCEL_DELIVERED,
      eventId,
      payload as unknown as Record<string, unknown>,
    );

    return {
      event: 'parcel.delivered',
      event_id: eventId,
      published_at: occurredAt,
      proof_of_delivery_id: proofOfDeliveryId,
    };
  }

  private async recordFailure(
    parcelId: string,
    direction: string,
    dto: DeliverDto,
  ): Promise<DeliverFailureResult> {
    const latestAttemptNumber =
      await this.courierRepository.getLatestAttemptNumber(parcelId, direction);
    if (latestAttemptNumber >= 3) {
      throw new BusinessRuleException(
        'BR-04',
        'RTS already triggered for this leg - a 4th delivery attempt must be routed as a reverse-leg attempt',
      );
    }

    const failureReason = dto.failure_reason as string;
    const { deliveryAttemptId, attemptNumber, rtsTriggered } =
      await this.courierRepository.recordDeliveryFailure(
        parcelId,
        direction,
        failureReason,
      );

    const failedEventId = randomUUID();
    const failedPayload: ParcelDeliveryFailedEventV1 = {
      event_id: failedEventId,
      occurred_at: new Date().toISOString(),
      parcel_id: parcelId,
      courier_id: dto.courier_id,
      failure_reason: failureReason,
    };
    await this.eventPublisher.publish(
      NATS_SUBJECTS.PARCEL_DELIVERY_FAILED,
      failedEventId,
      failedPayload as unknown as Record<string, unknown>,
    );

    const result: DeliverFailureResult = {
      delivery_attempt_id: deliveryAttemptId,
      attempt_number: attemptNumber,
    };

    if (rtsTriggered) {
      const rtsEventId = randomUUID();
      const rtsOccurredAt = new Date().toISOString();
      const rtsPayload: ParcelRtsEventV1 = {
        event_id: rtsEventId,
        occurred_at: rtsOccurredAt,
        parcel_id: parcelId,
      };
      await this.eventPublisher.publish(
        NATS_SUBJECTS.PARCEL_RTS,
        rtsEventId,
        rtsPayload as unknown as Record<string, unknown>,
      );
      result.rts = {
        event: 'parcel.rts',
        event_id: rtsEventId,
        published_at: rtsOccurredAt,
      };
    }

    return result;
  }
}

// BR-08 literally says "= Confirmed", but a multi-parcel order's status
// projection advances to Active as soon as its first parcel is picked up
// (BR-05), so a sibling parcel's later pickup must still pass this guard.
const CONFIRMED_OR_LATER = new Set([
  'Confirmed',
  'Active',
  'Complete',
  'Partially_Delivered',
]);
