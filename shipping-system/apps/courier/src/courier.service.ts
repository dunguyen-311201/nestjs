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
import { IIdempotencyStore } from './ports/idempotency-store.port';
import { PickupDto } from './dto/pickup.dto';
import { DeliverDto, DeliveryOutcome } from './dto/deliver.dto';

const IDEMPOTENCY_TTL_SECONDS = 24 * 60 * 60;

export interface PickupResult {
  status: 'recorded';
}

export interface DeliverSuccessResult {
  status: 'recorded';
  proof_of_delivery_id: string;
}

export interface DeliverFailureResult {
  status: 'recorded';
  delivery_attempt_id: string;
  attempt_number: number;
  rts_triggered: boolean;
}

export type DeliverResult = DeliverSuccessResult | DeliverFailureResult;

@Injectable()
export class CourierService {
  constructor(
    private readonly orderLookup: IOrderLookupPort,
    private readonly courierRepository: ICourierRepository,
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

    const payload: ParcelPickedUpEventV1 = {
      event_id: randomUUID(),
      occurred_at: new Date().toISOString(),
      parcel_id: parcelId,
      courier_id: dto.courier_id,
    };
    await this.courierRepository.recordPickup({
      eventId: payload.event_id,
      eventType: NATS_SUBJECTS.PARCEL_PICKED_UP,
      payload: payload as unknown as Record<string, unknown>,
    });

    const result: PickupResult = { status: 'recorded' };
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
    const payload: ParcelDeliveredEventV1 = {
      event_id: randomUUID(),
      occurred_at: new Date().toISOString(),
      parcel_id: parcelId,
      courier_id: dto.courier_id,
      signature_url: dto.signature_url ?? null,
      photo_url: dto.photo_url ?? null,
    };
    const { proofOfDeliveryId } =
      await this.courierRepository.recordDeliverySuccess(
        parcelId,
        dto.signature_url ?? null,
        dto.photo_url ?? null,
        {
          eventId: payload.event_id,
          eventType: NATS_SUBJECTS.PARCEL_DELIVERED,
          payload: payload as unknown as Record<string, unknown>,
        },
      );

    return { status: 'recorded', proof_of_delivery_id: proofOfDeliveryId };
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
    const failedPayload: ParcelDeliveryFailedEventV1 = {
      event_id: randomUUID(),
      occurred_at: new Date().toISOString(),
      parcel_id: parcelId,
      courier_id: dto.courier_id,
      failure_reason: failureReason,
    };
    // Always built ahead of time so the repository can insert it in the
    // same transaction as DELIVERY_ATTEMPT/OUTBOX when this insert turns
    // out to be the 3rd consecutive failure - the repository decides
    // whether to actually use it.
    const rtsPayload: ParcelRtsEventV1 = {
      event_id: randomUUID(),
      occurred_at: new Date().toISOString(),
      parcel_id: parcelId,
    };

    const { deliveryAttemptId, attemptNumber, rtsTriggered } =
      await this.courierRepository.recordDeliveryFailure(
        parcelId,
        direction,
        failureReason,
        {
          eventId: failedPayload.event_id,
          eventType: NATS_SUBJECTS.PARCEL_DELIVERY_FAILED,
          payload: failedPayload as unknown as Record<string, unknown>,
        },
        {
          eventId: rtsPayload.event_id,
          eventType: NATS_SUBJECTS.PARCEL_RTS,
          payload: rtsPayload as unknown as Record<string, unknown>,
        },
      );

    return {
      status: 'recorded',
      delivery_attempt_id: deliveryAttemptId,
      attempt_number: attemptNumber,
      rts_triggered: rtsTriggered,
    };
  }
}

// The paid-order pickup guard rule literally says "= Confirmed", but a
// multi-parcel order's status projection advances to Active as soon as its
// first parcel is picked up, so a sibling parcel's later pickup must still
// pass this guard.
const CONFIRMED_OR_LATER = new Set([
  'Confirmed',
  'Active',
  'Complete',
  'Partially_Delivered',
]);
