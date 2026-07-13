import { TrackingEventConsumer } from './tracking-event.consumer';
import { TrackingEventType } from '../entities/tracking-event.entity';

describe('TrackingEventConsumer', () => {
  let trackingEventRepository: { appendEvent: jest.Mock };
  let orderLookupPort: { findShipmentOrderIdByParcelId: jest.Mock };
  let statusTriggerPublisher: { publish: jest.Mock };
  let consumer: TrackingEventConsumer;

  beforeEach(() => {
    trackingEventRepository = {
      appendEvent: jest.fn().mockResolvedValue(undefined),
    };
    orderLookupPort = { findShipmentOrderIdByParcelId: jest.fn() };
    statusTriggerPublisher = {
      publish: jest.fn().mockResolvedValue(undefined),
    };
    consumer = new TrackingEventConsumer(
      trackingEventRepository as never,
      orderLookupPort as never,
      statusTriggerPublisher,
    );
  });

  it('appends the event and publishes a recompute trigger for the resolved order', async () => {
    orderLookupPort.findShipmentOrderIdByParcelId.mockResolvedValue('order-1');

    await consumer.onPickedUp({
      event_id: 'evt-1',
      parcel_id: 'parcel-1',
      courier_id: 'courier-1',
    });

    expect(trackingEventRepository.appendEvent).toHaveBeenCalledWith(
      expect.objectContaining({
        eventId: 'evt-1',
        parcelId: 'parcel-1',
        eventType: TrackingEventType.PICKUP,
      }),
    );
    expect(orderLookupPort.findShipmentOrderIdByParcelId).toHaveBeenCalledWith(
      'parcel-1',
    );
    expect(statusTriggerPublisher.publish).toHaveBeenCalledWith('order-1');
  });

  it('still appends the event but skips the publish when the order cannot be resolved', async () => {
    orderLookupPort.findShipmentOrderIdByParcelId.mockResolvedValue(null);

    await consumer.onPickedUp({ event_id: 'evt-2', parcel_id: 'parcel-2' });

    expect(trackingEventRepository.appendEvent).toHaveBeenCalled();
    expect(statusTriggerPublisher.publish).not.toHaveBeenCalled();
  });

  it('does nothing for a malformed/unrecognized payload', async () => {
    await consumer.onPickedUp({});

    expect(trackingEventRepository.appendEvent).not.toHaveBeenCalled();
    expect(
      orderLookupPort.findShipmentOrderIdByParcelId,
    ).not.toHaveBeenCalled();
  });

  it('exposes one handler per consumed subject', () => {
    expect(typeof consumer.onPickedUp).toBe('function');
    expect(typeof consumer.onHubReceived).toBe('function');
    expect(typeof consumer.onLoadedForLinehaul).toBe('function');
    expect(typeof consumer.onArrivedAtHub).toBe('function');
    expect(typeof consumer.onOutForDelivery).toBe('function');
    expect(typeof consumer.onDelivered).toBe('function');
    expect(typeof consumer.onMisrouted).toBe('function');
    expect(typeof consumer.onRts).toBe('function');
  });

  it('maps parcel.misrouted using scanned_hub_id (sanity check the shared mapper is still used)', async () => {
    orderLookupPort.findShipmentOrderIdByParcelId.mockResolvedValue(null);

    await consumer.onMisrouted({
      event_id: 'evt-3',
      parcel_id: 'parcel-3',
      scanned_hub_id: 'hub-1',
    });

    expect(trackingEventRepository.appendEvent).toHaveBeenCalledWith(
      expect.objectContaining({
        eventType: TrackingEventType.MISROUTED,
        hubId: 'hub-1',
      }),
    );
  });
});
