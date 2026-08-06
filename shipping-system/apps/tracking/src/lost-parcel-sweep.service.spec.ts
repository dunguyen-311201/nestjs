/* eslint-disable @typescript-eslint/unbound-method -- jest.fn() mocks flagged as false positives */
import { LostParcelSweepService } from './lost-parcel-sweep.service';
import { IOrderLookupPort } from './ports/order-lookup.port';
import { ITrackingEventRepository } from './ports/tracking-event-repository.port';
import { IEventPublisher } from './ports/event-publisher.port';
import { TrackingEventType } from './entities/tracking-event.entity';

describe('LostParcelSweepService', () => {
  let orderLookupPort: jest.Mocked<
    Pick<IOrderLookupPort, 'findSlaBreachedParcelIds'>
  >;
  let trackingEventRepository: jest.Mocked<
    Pick<ITrackingEventRepository, 'findTimelineByParcelIds'>
  >;
  let eventPublisher: jest.Mocked<IEventPublisher>;
  let service: LostParcelSweepService;

  beforeEach(() => {
    orderLookupPort = { findSlaBreachedParcelIds: jest.fn() };
    trackingEventRepository = { findTimelineByParcelIds: jest.fn() };
    eventPublisher = { publish: jest.fn().mockResolvedValue(undefined) };
    service = new LostParcelSweepService(
      orderLookupPort as never,
      trackingEventRepository as never,
      eventPublisher,
    );
  });

  it('does nothing when no parcel has breached its SLA', async () => {
    orderLookupPort.findSlaBreachedParcelIds.mockResolvedValue([]);

    await service.sweep();

    expect(
      trackingEventRepository.findTimelineByParcelIds,
    ).not.toHaveBeenCalled();
    expect(eventPublisher.publish).not.toHaveBeenCalled();
  });

  it('publishes parcel.lost_suspected for a breached parcel still in transit', async () => {
    orderLookupPort.findSlaBreachedParcelIds.mockResolvedValue(['parcel-1']);
    trackingEventRepository.findTimelineByParcelIds.mockResolvedValue([
      {
        id: 'te-1',
        eventId: 'evt-1',
        parcelId: 'parcel-1',
        hubId: null,
        courierId: null,
        linehaulTripId: 'trip-1',
        eventType: TrackingEventType.DEPARTED_LINEHAUL,
        createdAt: new Date('2026-08-01T00:00:00Z'),
      },
    ]);

    await service.sweep();

    expect(eventPublisher.publish).toHaveBeenCalledTimes(1);
    const [subject, , payload] = eventPublisher.publish.mock.calls[0];
    expect(subject).toBe('parcel.lost_suspected');
    expect(payload).toMatchObject({
      parcel_id: 'parcel-1',
      last_scan_type: TrackingEventType.DEPARTED_LINEHAUL,
      last_scan_at: '2026-08-01T00:00:00.000Z',
    });
  });

  it('publishes for a breached parcel out for delivery', async () => {
    orderLookupPort.findSlaBreachedParcelIds.mockResolvedValue(['parcel-1']);
    trackingEventRepository.findTimelineByParcelIds.mockResolvedValue([
      {
        eventType: TrackingEventType.OUT_FOR_DELIVERY,
        createdAt: new Date('2026-08-01T00:00:00Z'),
        parcelId: 'parcel-1',
      } as never,
    ]);

    await service.sweep();

    expect(eventPublisher.publish).toHaveBeenCalledTimes(1);
  });

  it('does not publish when the parcel has no tracking events at all', async () => {
    orderLookupPort.findSlaBreachedParcelIds.mockResolvedValue(['parcel-1']);
    trackingEventRepository.findTimelineByParcelIds.mockResolvedValue([]);

    await service.sweep();

    expect(eventPublisher.publish).not.toHaveBeenCalled();
  });

  it('does not publish when the parcel already has a later terminal-bound scan (e.g. arrived at the next hub)', async () => {
    orderLookupPort.findSlaBreachedParcelIds.mockResolvedValue(['parcel-1']);
    trackingEventRepository.findTimelineByParcelIds.mockResolvedValue([
      {
        eventType: TrackingEventType.DEPARTED_LINEHAUL,
        createdAt: new Date('2026-08-01T00:00:00Z'),
        parcelId: 'parcel-1',
      } as never,
      {
        eventType: TrackingEventType.ARRIVED_AT_HUB,
        createdAt: new Date('2026-08-02T00:00:00Z'),
        parcelId: 'parcel-1',
      } as never,
    ]);

    await service.sweep();

    expect(eventPublisher.publish).not.toHaveBeenCalled();
  });

  it('sweeps multiple candidate parcels independently', async () => {
    orderLookupPort.findSlaBreachedParcelIds.mockResolvedValue([
      'parcel-1',
      'parcel-2',
    ]);
    trackingEventRepository.findTimelineByParcelIds.mockResolvedValue([
      {
        eventType: TrackingEventType.DEPARTED_LINEHAUL,
        createdAt: new Date('2026-08-01T00:00:00Z'),
        parcelId: 'parcel-1',
      } as never,
      {
        eventType: TrackingEventType.DELIVERED,
        createdAt: new Date('2026-08-01T00:00:00Z'),
        parcelId: 'parcel-2',
      } as never,
    ]);

    await service.sweep();

    expect(eventPublisher.publish).toHaveBeenCalledTimes(1);
    const [, , payload] = eventPublisher.publish.mock.calls[0];
    expect(payload).toMatchObject({ parcel_id: 'parcel-1' });
  });
});
