import { NotFoundException } from '@nestjs/common';
import { TrackingService } from './tracking.service';
import { TrackingEventType } from './entities/tracking-event.entity';

describe('TrackingService', () => {
  let orderLookupPort: {
    findParcelsByShipmentOrderId: jest.Mock;
    findShipmentOrderIdByShareToken: jest.Mock;
  };
  let trackingEventRepository: { findTimelineByParcelIds: jest.Mock };
  let statusCachePort: { getStatus: jest.Mock };
  let service: TrackingService;

  beforeEach(() => {
    orderLookupPort = {
      findParcelsByShipmentOrderId: jest.fn(),
      findShipmentOrderIdByShareToken: jest.fn(),
    };
    trackingEventRepository = { findTimelineByParcelIds: jest.fn() };
    statusCachePort = { getStatus: jest.fn().mockResolvedValue(null) };
    service = new TrackingService(
      orderLookupPort,
      trackingEventRepository as never,
      statusCachePort,
    );
  });

  it('throws NotFoundException when the shipment_order_id does not resolve', async () => {
    orderLookupPort.findParcelsByShipmentOrderId.mockResolvedValue(null);

    await expect(service.getTracking('missing-id')).rejects.toThrow(
      NotFoundException,
    );
  });

  it('groups the timeline per parcel for an existing order', async () => {
    orderLookupPort.findParcelsByShipmentOrderId.mockResolvedValue([
      { id: 'parcel-1', state: 'InTransit' },
      { id: 'parcel-2', state: 'Delivered' },
    ]);
    trackingEventRepository.findTimelineByParcelIds.mockResolvedValue([
      {
        parcelId: 'parcel-1',
        eventType: TrackingEventType.PICKUP,
        hubId: null,
        courierId: 'courier-1',
        linehaulTripId: null,
        createdAt: new Date('2026-01-01T00:00:00Z'),
      },
      {
        parcelId: 'parcel-2',
        eventType: TrackingEventType.DELIVERED,
        hubId: null,
        courierId: 'courier-2',
        linehaulTripId: null,
        createdAt: new Date('2026-01-02T00:00:00Z'),
      },
    ]);

    const result = await service.getTracking('order-1');

    expect(result.shipment_order_id).toBe('order-1');
    expect(result.status).toBeNull();
    expect(result.parcels).toEqual([
      {
        parcel_id: 'parcel-1',
        state: 'InTransit',
        timeline: [
          expect.objectContaining({ event_type: TrackingEventType.PICKUP }),
        ],
      },
      {
        parcel_id: 'parcel-2',
        state: 'Delivered',
        timeline: [
          expect.objectContaining({ event_type: TrackingEventType.DELIVERED }),
        ],
      },
    ]);
  });

  it('returns the cached status when available', async () => {
    orderLookupPort.findParcelsByShipmentOrderId.mockResolvedValue([
      { id: 'parcel-1', state: 'Delivered' },
    ]);
    trackingEventRepository.findTimelineByParcelIds.mockResolvedValue([]);
    statusCachePort.getStatus.mockResolvedValue('Complete');

    const result = await service.getTracking('order-1');

    expect(statusCachePort.getStatus).toHaveBeenCalledWith('order-1');
    expect(result.status).toBe('Complete');
  });

  describe('getTrackingByShareToken', () => {
    it('throws NotFoundException when the share token does not resolve', async () => {
      orderLookupPort.findShipmentOrderIdByShareToken.mockResolvedValue(null);

      await expect(
        service.getTrackingByShareToken('bad-token'),
      ).rejects.toThrow(NotFoundException);
      expect(
        orderLookupPort.findParcelsByShipmentOrderId,
      ).not.toHaveBeenCalled();
    });

    it('resolves the token to an order and returns the same tracking payload', async () => {
      orderLookupPort.findShipmentOrderIdByShareToken.mockResolvedValue(
        'order-1',
      );
      orderLookupPort.findParcelsByShipmentOrderId.mockResolvedValue([
        { id: 'parcel-1', state: 'Delivered' },
      ]);
      trackingEventRepository.findTimelineByParcelIds.mockResolvedValue([]);

      const result = await service.getTrackingByShareToken('good-token');

      expect(
        orderLookupPort.findShipmentOrderIdByShareToken,
      ).toHaveBeenCalledWith('good-token');
      expect(result.shipment_order_id).toBe('order-1');
    });
  });
});
