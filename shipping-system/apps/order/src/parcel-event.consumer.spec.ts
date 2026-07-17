import { ParcelEventConsumer } from './parcel-event.consumer';
import { ParcelDirection, ParcelState } from './entities/parcel.enums';

describe('ParcelEventConsumer', () => {
  let orderRepository: {
    findParcelById: jest.Mock;
    updateParcelState: jest.Mock;
    updateParcelStateAndDirection: jest.Mock;
    updateParcelWeightAndRoute: jest.Mock;
    updateParcelAssignedCourier: jest.Mock;
  };
  let consumer: ParcelEventConsumer;

  beforeEach(() => {
    orderRepository = {
      findParcelById: jest.fn(),
      updateParcelState: jest.fn().mockResolvedValue(undefined),
      updateParcelStateAndDirection: jest.fn().mockResolvedValue(undefined),
      updateParcelWeightAndRoute: jest.fn().mockResolvedValue(undefined),
      updateParcelAssignedCourier: jest.fn().mockResolvedValue(undefined),
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

  it('applies actual_weight_grams (BR-06) on parcel.hub_received alongside the state transition', async () => {
    orderRepository.findParcelById.mockResolvedValue({
      id: 'parcel-1',
      state: ParcelState.IN_TRANSIT,
    });

    await consumer.onHubReceived({
      parcel_id: 'parcel-1',
      actual_weight_grams: 520,
    });

    expect(orderRepository.updateParcelWeightAndRoute).toHaveBeenCalledWith(
      'parcel-1',
      { actualWeightGrams: 520 },
    );
  });

  it('applies route_id (BR-02 corrective re-route) on parcel.hub_received when present', async () => {
    orderRepository.findParcelById.mockResolvedValue({
      id: 'parcel-1',
      state: ParcelState.MISROUTED,
    });

    await consumer.onHubReceived({
      parcel_id: 'parcel-1',
      actual_weight_grams: 520,
      route_id: 'route-2',
    });

    expect(orderRepository.updateParcelWeightAndRoute).toHaveBeenCalledWith(
      'parcel-1',
      { actualWeightGrams: 520, routeId: 'route-2' },
    );
  });

  it('does not call updateParcelWeightAndRoute for other subjects', async () => {
    orderRepository.findParcelById.mockResolvedValue({
      id: 'parcel-1',
      state: ParcelState.IN_HUB,
    });

    await consumer.onOutForDelivery({ parcel_id: 'parcel-1' });

    expect(orderRepository.updateParcelWeightAndRoute).not.toHaveBeenCalled();
  });

  it('persists the courier assignment on parcel.out_for_delivery alongside the state transition', async () => {
    orderRepository.findParcelById.mockResolvedValue({
      id: 'parcel-1',
      state: ParcelState.IN_HUB,
    });

    await consumer.onOutForDelivery({
      parcel_id: 'parcel-1',
      courier_id: 'courier-9',
    });

    expect(orderRepository.updateParcelAssignedCourier).toHaveBeenCalledWith(
      'parcel-1',
      'courier-9',
    );
    expect(orderRepository.updateParcelState).toHaveBeenCalledWith(
      'parcel-1',
      ParcelState.OUT_FOR_DELIVERY,
    );
  });

  it('skips the assignment write when parcel.out_for_delivery carries no courier_id', async () => {
    orderRepository.findParcelById.mockResolvedValue({
      id: 'parcel-1',
      state: ParcelState.IN_HUB,
    });

    await consumer.onOutForDelivery({ parcel_id: 'parcel-1' });

    expect(orderRepository.updateParcelAssignedCourier).not.toHaveBeenCalled();
    expect(orderRepository.updateParcelState).toHaveBeenCalled();
  });

  it('persists the assignment even when the state transition is dropped as invalid', async () => {
    orderRepository.findParcelById.mockResolvedValue({
      id: 'parcel-1',
      state: ParcelState.IN_TRANSIT,
    });

    await consumer.onOutForDelivery({
      parcel_id: 'parcel-1',
      courier_id: 'courier-9',
    });

    expect(orderRepository.updateParcelAssignedCourier).toHaveBeenCalledWith(
      'parcel-1',
      'courier-9',
    );
    expect(orderRepository.updateParcelState).not.toHaveBeenCalled();
  });

  it('does not persist an assignment for other subjects', async () => {
    orderRepository.findParcelById.mockResolvedValue({
      id: 'parcel-1',
      state: ParcelState.CREATED,
    });

    await consumer.onPickedUp({ parcel_id: 'parcel-1' });

    expect(orderRepository.updateParcelAssignedCourier).not.toHaveBeenCalled();
  });

  it('does nothing when the payload is missing parcel_id', async () => {
    await consumer.onPickedUp({});

    expect(orderRepository.findParcelById).not.toHaveBeenCalled();
  });

  it('processes RTS event by flipping state and direction', async () => {
    orderRepository.findParcelById.mockResolvedValue({
      id: 'parcel-1',
      state: ParcelState.OUT_FOR_DELIVERY,
      direction: ParcelDirection.FORWARD,
    });

    await consumer.onRts({ parcel_id: 'parcel-1' });

    expect(orderRepository.updateParcelStateAndDirection).toHaveBeenCalledWith(
      'parcel-1',
      ParcelState.IN_TRANSIT,
      ParcelDirection.REVERSE_RTS,
    );
  });

  it('drops RTS event when invalid without throwing', async () => {
    orderRepository.findParcelById.mockResolvedValue({
      id: 'parcel-1',
      state: ParcelState.CREATED,
    });

    await expect(
      consumer.onRts({ parcel_id: 'parcel-1' }),
    ).resolves.not.toThrow();
    expect(
      orderRepository.updateParcelStateAndDirection,
    ).not.toHaveBeenCalled();
  });

  it('processes LOST_SUSPECTED event by changing state to LOST', async () => {
    orderRepository.findParcelById.mockResolvedValue({
      id: 'parcel-1',
      state: ParcelState.IN_TRANSIT,
    });

    await consumer.onLostSuspected({ parcel_id: 'parcel-1' });

    expect(orderRepository.updateParcelState).toHaveBeenCalledWith(
      'parcel-1',
      ParcelState.LOST,
    );
  });

  it('drops LOST_SUSPECTED event when invalid without throwing', async () => {
    orderRepository.findParcelById.mockResolvedValue({
      id: 'parcel-1',
      state: ParcelState.CREATED,
    });

    await expect(
      consumer.onLostSuspected({ parcel_id: 'parcel-1' }),
    ).resolves.not.toThrow();
    expect(orderRepository.updateParcelState).not.toHaveBeenCalled();
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
    expect(typeof consumer.onLostSuspected).toBe('function');
  });
});
