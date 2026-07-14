import { Injectable, NotFoundException } from '@nestjs/common';
import { randomUUID } from 'node:crypto';
import { BusinessRuleException } from '@app/dtos';
import {
  NATS_SUBJECTS,
  ParcelArrivedAtHubEventV1,
  ParcelHubReceivedEventV1,
  ParcelMisroutedEventV1,
} from '@app/contracts';
import { IOrderLookupPort } from './ports/order-lookup.port';
import { IHubRepository, OutboxEventInput } from './ports/hub-repository.port';
import { IIdempotencyStore } from './ports/idempotency-store.port';
import { ReceiveDto } from './dto/receive.dto';

const IDEMPOTENCY_TTL_SECONDS = 24 * 60 * 60;

export interface ReceiveResult {
  status: 'recorded';
}

// BR-08 literally says "= Confirmed", but a multi-parcel order's status
// projection advances to Active as soon as its first parcel is picked up
// (BR-05), so a later hub scan for a sibling parcel must still pass this
// guard. Same set as Courier's CourierService.
const CONFIRMED_OR_LATER = new Set([
  'Confirmed',
  'Active',
  'Complete',
  'Partially_Delivered',
]);

@Injectable()
export class HubService {
  constructor(
    private readonly orderLookup: IOrderLookupPort,
    private readonly hubRepository: IHubRepository,
    private readonly idempotencyStore: IIdempotencyStore,
  ) {}

  async receive(
    hubId: string,
    dto: ReceiveDto,
    idempotencyKey: string,
  ): Promise<ReceiveResult> {
    const cacheKey = `idem:hub:${idempotencyKey}`;
    const cached = await this.idempotencyStore.get<ReceiveResult>(cacheKey);
    if (cached) {
      return cached;
    }

    const hub = await this.hubRepository.findHubById(hubId);
    if (!hub) {
      throw new NotFoundException(`No hub found for id ${hubId}`);
    }

    const context = await this.orderLookup.findParcelOrderContext(
      dto.parcel_id,
    );
    if (!context) {
      throw new NotFoundException(`No parcel found for id ${dto.parcel_id}`);
    }
    if (!CONFIRMED_OR_LATER.has(context.orderStatus)) {
      throw new BusinessRuleException(
        'BR-08',
        'Parent order is not yet Confirmed - hub inbound is blocked until payment is confirmed',
      );
    }

    const events: OutboxEventInput[] = dto.linehaul_trip_id
      ? await this.buildTransitScanEvents(hub, dto, context.routeId)
      : [this.buildOriginScanEvent(hub.id, dto)];

    await this.hubRepository.recordScan(events);

    const result: ReceiveResult = { status: 'recorded' };
    await this.idempotencyStore.set(cacheKey, result, IDEMPOTENCY_TTL_SECONDS);
    return result;
  }

  private buildOriginScanEvent(
    hubId: string,
    dto: ReceiveDto,
  ): OutboxEventInput {
    const payload: ParcelHubReceivedEventV1 = {
      event_id: randomUUID(),
      occurred_at: new Date().toISOString(),
      parcel_id: dto.parcel_id,
      hub_id: hubId,
      actual_weight_grams: dto.actual_weight_grams as number,
    };
    return {
      eventId: payload.event_id,
      eventType: NATS_SUBJECTS.PARCEL_HUB_RECEIVED,
      payload: payload as unknown as Record<string, unknown>,
    };
  }

  private async buildTransitScanEvents(
    hub: { id: string; zoneId: string },
    dto: ReceiveDto,
    routeId: string | null,
  ): Promise<OutboxEventInput[]> {
    const currentRoute = routeId
      ? await this.hubRepository.findRouteById(routeId)
      : null;

    if (currentRoute && currentRoute.destZoneId === hub.zoneId) {
      const payload: ParcelArrivedAtHubEventV1 = {
        event_id: randomUUID(),
        occurred_at: new Date().toISOString(),
        parcel_id: dto.parcel_id,
        hub_id: hub.id,
        linehaul_trip_id: dto.linehaul_trip_id as string,
      };
      return [
        {
          eventId: payload.event_id,
          eventType: NATS_SUBJECTS.PARCEL_ARRIVED_AT_HUB,
          payload: payload as unknown as Record<string, unknown>,
        },
      ];
    }

    // Misrouted (BR-02): publish the misrouted scan, then recompute the
    // corridor from the actual scanning zone to the parcel's original
    // destination zone and republish a corrective parcel.hub_received
    // carrying the new route_id - Order's ParcelEventConsumer applies it
    // to PARCEL.route_id, since Hub never writes cross-schema.
    const misroutedPayload: ParcelMisroutedEventV1 = {
      event_id: randomUUID(),
      occurred_at: new Date().toISOString(),
      parcel_id: dto.parcel_id,
      scanned_hub_id: hub.id,
    };

    const correctiveRoute = currentRoute
      ? await this.hubRepository.findRouteByZones(
          hub.zoneId,
          currentRoute.destZoneId,
        )
      : null;

    const correctivePayload: ParcelHubReceivedEventV1 = {
      event_id: randomUUID(),
      occurred_at: new Date().toISOString(),
      parcel_id: dto.parcel_id,
      hub_id: hub.id,
      actual_weight_grams: dto.actual_weight_grams as number,
      ...(correctiveRoute ? { route_id: correctiveRoute.id } : {}),
    };

    return [
      {
        eventId: misroutedPayload.event_id,
        eventType: NATS_SUBJECTS.PARCEL_MISROUTED,
        payload: misroutedPayload as unknown as Record<string, unknown>,
      },
      {
        eventId: correctivePayload.event_id,
        eventType: NATS_SUBJECTS.PARCEL_HUB_RECEIVED,
        payload: correctivePayload as unknown as Record<string, unknown>,
      },
    ];
  }
}
