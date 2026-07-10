import { NotFoundException } from '@nestjs/common';
import { TrackingService } from './tracking.service';
import { TrackingEventType } from './entities/tracking-event.entity';

describe('TrackingService', () => {
  let orderLookupPort: { findParcelsByShipmentOrderId: jest.Mock };
  let trackingEventRepository: { findTimelineByParcelIds: jest.Mock };
  let service: TrackingService;

  beforeEach(() => {
    orderLookupPort = { findParcelsByShipmentOrderId: jest.fn() };
    trackingEventRepository = { findTimelineByParcelIds: jest.fn() };
    service = new TrackingService(
      orderLookupPort,
      trackingEventRepository as never,
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
});
