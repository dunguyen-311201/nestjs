import { ParcelEventConsumer } from './parcel-event.consumer';
import { ParcelState } from './entities/parcel.enums';

describe('ParcelEventConsumer', () => {
  let orderRepository: {
    findParcelById: jest.Mock;
    updateParcelState: jest.Mock;
  };
  let consumer: ParcelEventConsumer;

  beforeEach(() => {
    orderRepository = {
      findParcelById: jest.fn(),
      updateParcelState: jest.fn().mockResolvedValue(undefined),
    };
    consumer = new ParcelEventConsumer(orderRepository as never);
  });

  it('transitions the parcel state and persists it on a recognized event', async () => {
    orderRepository.findParcelById.mockResolvedValue({
      id: 'parcel-1',
      state: ParcelState.IN_HUB,
    });

    await consumer.onOutForDelivery({ parcel_id: 'parcel-1' });

    expect(orderRepository.updateParcelState).toHaveBeenCalledWith(
      'parcel-1',
      ParcelState.OUT_FOR_DELIVERY,
    );
  });

  it('does nothing when the parcel is not found', async () => {
    orderRepository.findParcelById.mockResolvedValue(null);

    await consumer.onPickedUp({ parcel_id: 'unknown' });

    expect(orderRepository.updateParcelState).not.toHaveBeenCalled();
  });

  it('drops the event without throwing when the transition is invalid (e.g. BR-02 guard)', async () => {
    orderRepository.findParcelById.mockResolvedValue({
      id: 'parcel-1',
      state: ParcelState.IN_TRANSIT,
    });

    await expect(
      consumer.onOutForDelivery({ parcel_id: 'parcel-1' }),
    ).resolves.not.toThrow();
    expect(orderRepository.updateParcelState).not.toHaveBeenCalled();
  });

  it('does nothing when the payload is missing parcel_id', async () => {
    await consumer.onPickedUp({});

    expect(orderRepository.findParcelById).not.toHaveBeenCalled();
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
});
