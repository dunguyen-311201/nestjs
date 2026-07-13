import { StatusProjectionConsumer } from './status-projection.consumer';
import { ParcelState } from './entities/parcel.enums';
import { ShipmentOrderStatus } from './entities/shipment-order-status.enum';

describe('StatusProjectionConsumer', () => {
  let orderRepository: {
    findParcelStatesByShipmentOrderId: jest.Mock;
    updateShipmentOrderStatus: jest.Mock;
  };
  let redis: { set: jest.Mock };
  let consumer: StatusProjectionConsumer;
  const DEBOUNCE_MS = 50;

  beforeEach(() => {
    jest.useFakeTimers();
    orderRepository = {
      findParcelStatesByShipmentOrderId: jest.fn(),
      updateShipmentOrderStatus: jest.fn().mockResolvedValue(undefined),
    };
    redis = { set: jest.fn().mockResolvedValue(undefined) };
    consumer = new StatusProjectionConsumer(
      orderRepository as never,
      redis as never,
      DEBOUNCE_MS,
    );
  });

  afterEach(() => {
    jest.useRealTimers();
  });

  it('debounces multiple triggers for the same order into a single recompute', () => {
    orderRepository.findParcelStatesByShipmentOrderId.mockResolvedValue([
      ParcelState.DELIVERED,
    ]);

    consumer.scheduleRecompute('order-1');
    consumer.scheduleRecompute('order-1');
    consumer.scheduleRecompute('order-1');
    jest.advanceTimersByTime(DEBOUNCE_MS + 10);

    expect(
      orderRepository.findParcelStatesByShipmentOrderId,
    ).toHaveBeenCalledTimes(1);
  });

  it('recomputes independently per order id (no cross-order debounce)', () => {
    orderRepository.findParcelStatesByShipmentOrderId.mockResolvedValue([
      ParcelState.DELIVERED,
    ]);

    consumer.scheduleRecompute('order-1');
    consumer.scheduleRecompute('order-2');
    jest.advanceTimersByTime(DEBOUNCE_MS + 10);

    expect(
      orderRepository.findParcelStatesByShipmentOrderId,
    ).toHaveBeenCalledWith('order-1');
    expect(
      orderRepository.findParcelStatesByShipmentOrderId,
    ).toHaveBeenCalledWith('order-2');
    expect(
      orderRepository.findParcelStatesByShipmentOrderId,
    ).toHaveBeenCalledTimes(2);
  });

  it('writes the recomputed status to Postgres and write-through to Redis', async () => {
    orderRepository.findParcelStatesByShipmentOrderId.mockResolvedValue([
      ParcelState.DELIVERED,
      ParcelState.LOST,
    ]);

    await consumer.recompute('order-1');

    expect(orderRepository.updateShipmentOrderStatus).toHaveBeenCalledWith(
      'order-1',
      ShipmentOrderStatus.PARTIALLY_DELIVERED,
    );
    expect(redis.set).toHaveBeenCalledWith(
      'order:status:order-1',
      ShipmentOrderStatus.PARTIALLY_DELIVERED,
    );
  });

  it('does nothing when the order no longer resolves to any parcels', async () => {
    orderRepository.findParcelStatesByShipmentOrderId.mockResolvedValue(null);

    await consumer.recompute('missing-order');

    expect(orderRepository.updateShipmentOrderStatus).not.toHaveBeenCalled();
    expect(redis.set).not.toHaveBeenCalled();
  });

  it('extracts the shipment_order_id from a JetStream message subject, schedules a recompute, then acks', () => {
    const scheduleSpy = jest.spyOn(consumer, 'scheduleRecompute');
    const ack = jest.fn();
    const message = { subject: 'shipment_orders.status.order-1', ack };

    consumer.handleMessage(message as never);

    expect(scheduleSpy).toHaveBeenCalledWith('order-1');
    expect(ack).toHaveBeenCalledTimes(1);
  });

  it('acks without scheduling when the subject has no trailing shipment_order_id', () => {
    const scheduleSpy = jest.spyOn(consumer, 'scheduleRecompute');
    const ack = jest.fn();
    const message = { subject: 'shipment_orders.status.', ack };

    consumer.handleMessage(message as never);

    expect(scheduleSpy).not.toHaveBeenCalled();
    expect(ack).toHaveBeenCalledTimes(1);
  });
});
