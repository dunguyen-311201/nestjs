/* eslint-disable @typescript-eslint/unbound-method -- jest.fn() mocks flagged as false positives */
import { NotFoundException } from '@nestjs/common';
import { BusinessRuleException } from '@app/dtos';
import { NATS_SUBJECTS } from '@app/contracts';
import { HubService } from './hub.service';
import { IOrderLookupPort } from './ports/order-lookup.port';
import { IHubRepository } from './ports/hub-repository.port';
import { IIdempotencyStore } from './ports/idempotency-store.port';

describe('HubService', () => {
  let orderLookup: jest.Mocked<IOrderLookupPort>;
  let hubRepository: jest.Mocked<IHubRepository>;
  let idempotencyStore: jest.Mocked<IIdempotencyStore>;
  let service: HubService;

  beforeEach(() => {
    orderLookup = { findParcelOrderContext: jest.fn() };
    hubRepository = {
      findHubById: jest.fn(),
      findRouteById: jest.fn(),
      findRouteByZones: jest.fn(),
      recordScan: jest.fn().mockResolvedValue(undefined),
    };
    idempotencyStore = { get: jest.fn(), set: jest.fn() };
    idempotencyStore.get.mockResolvedValue(null);
    service = new HubService(orderLookup, hubRepository, idempotencyStore);
  });

  it('throws 404 when the hub does not exist', async () => {
    hubRepository.findHubById.mockResolvedValue(null);

    await expect(
      service.receive('hub-1', { parcel_id: 'parcel-1' }, 'idem-1'),
    ).rejects.toThrow(NotFoundException);
    expect(hubRepository.recordScan).not.toHaveBeenCalled();
  });

  it('throws 404 when the parcel does not exist', async () => {
    hubRepository.findHubById.mockResolvedValue({
      id: 'hub-1',
      zoneId: 'zone-1',
    });
    orderLookup.findParcelOrderContext.mockResolvedValue(null);

    await expect(
      service.receive('hub-1', { parcel_id: 'parcel-1' }, 'idem-1'),
    ).rejects.toThrow(NotFoundException);
  });

  it('throws 422 BR-08 when the parent order is not yet Confirmed+', async () => {
    hubRepository.findHubById.mockResolvedValue({
      id: 'hub-1',
      zoneId: 'zone-1',
    });
    orderLookup.findParcelOrderContext.mockResolvedValue({
      shipmentOrderId: 'order-1',
      orderStatus: 'Created',
      routeId: 'route-1',
    });

    const error = await service
      .receive('hub-1', { parcel_id: 'parcel-1' }, 'idem-1')
      .catch((e: unknown) => e);

    expect(error).toBeInstanceOf(BusinessRuleException);
    expect((error as BusinessRuleException).rule).toBe('BR-08');
    expect(hubRepository.recordScan).not.toHaveBeenCalled();
  });

  it('records a plain parcel.hub_received for an origin scan (no linehaul_trip_id)', async () => {
    hubRepository.findHubById.mockResolvedValue({
      id: 'hub-1',
      zoneId: 'zone-1',
    });
    orderLookup.findParcelOrderContext.mockResolvedValue({
      shipmentOrderId: 'order-1',
      orderStatus: 'Confirmed',
      routeId: 'route-1',
    });

    const result = await service.receive(
      'hub-1',
      { parcel_id: 'parcel-1', actual_weight_grams: 500 },
      'idem-1',
    );

    expect(result).toEqual({ status: 'recorded' });
    expect(hubRepository.recordScan).toHaveBeenCalledWith([
      expect.objectContaining({
        eventType: NATS_SUBJECTS.PARCEL_HUB_RECEIVED,
        payload: expect.objectContaining({
          parcel_id: 'parcel-1',
          hub_id: 'hub-1',
          actual_weight_grams: 500,
        }) as unknown,
      }),
    ]);
    expect(hubRepository.findRouteById).not.toHaveBeenCalled();
  });

  it('records parcel.arrived_at_hub when the scanning hub matches the route destination zone', async () => {
    hubRepository.findHubById.mockResolvedValue({
      id: 'hub-1',
      zoneId: 'zone-2',
    });
    orderLookup.findParcelOrderContext.mockResolvedValue({
      shipmentOrderId: 'order-1',
      orderStatus: 'Active',
      routeId: 'route-1',
    });
    hubRepository.findRouteById.mockResolvedValue({
      id: 'route-1',
      originZoneId: 'zone-1',
      destZoneId: 'zone-2',
    });

    const result = await service.receive(
      'hub-1',
      { parcel_id: 'parcel-1', linehaul_trip_id: 'trip-1' },
      'idem-1',
    );

    expect(result).toEqual({ status: 'recorded' });
    expect(hubRepository.recordScan).toHaveBeenCalledWith([
      expect.objectContaining({
        eventType: NATS_SUBJECTS.PARCEL_ARRIVED_AT_HUB,
        payload: expect.objectContaining({
          parcel_id: 'parcel-1',
          hub_id: 'hub-1',
          linehaul_trip_id: 'trip-1',
        }) as unknown,
      }),
    ]);
  });

  it('records parcel.misrouted + a corrective parcel.hub_received when the zone mismatches (BR-02)', async () => {
    hubRepository.findHubById.mockResolvedValue({
      id: 'hub-1',
      zoneId: 'zone-9',
    });
    orderLookup.findParcelOrderContext.mockResolvedValue({
      shipmentOrderId: 'order-1',
      orderStatus: 'Active',
      routeId: 'route-1',
    });
    hubRepository.findRouteById.mockResolvedValue({
      id: 'route-1',
      originZoneId: 'zone-1',
      destZoneId: 'zone-2',
    });
    hubRepository.findRouteByZones.mockResolvedValue({
      id: 'route-corrective',
      originZoneId: 'zone-9',
      destZoneId: 'zone-2',
    });

    const result = await service.receive(
      'hub-1',
      {
        parcel_id: 'parcel-1',
        linehaul_trip_id: 'trip-1',
        actual_weight_grams: 500,
      },
      'idem-1',
    );

    expect(result).toEqual({ status: 'recorded' });
    expect(hubRepository.findRouteByZones).toHaveBeenCalledWith(
      'zone-9',
      'zone-2',
    );
    expect(hubRepository.recordScan).toHaveBeenCalledWith([
      expect.objectContaining({
        eventType: NATS_SUBJECTS.PARCEL_MISROUTED,
        payload: expect.objectContaining({
          parcel_id: 'parcel-1',
          scanned_hub_id: 'hub-1',
        }) as unknown,
      }),
      expect.objectContaining({
        eventType: NATS_SUBJECTS.PARCEL_HUB_RECEIVED,
        payload: expect.objectContaining({
          parcel_id: 'parcel-1',
          hub_id: 'hub-1',
          actual_weight_grams: 500,
          route_id: 'route-corrective',
        }) as unknown,
      }),
    ]);
  });

  it('replays the cached response on a repeated Idempotency-Key', async () => {
    const cached = { status: 'recorded' };
    idempotencyStore.get.mockResolvedValue(cached);

    const result = await service.receive(
      'hub-1',
      { parcel_id: 'parcel-1' },
      'idem-1',
    );

    expect(result).toBe(cached);
    expect(hubRepository.findHubById).not.toHaveBeenCalled();
  });
});
