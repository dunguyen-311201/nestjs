import { ensureShipmentOrderStatusStream } from './ensure-shipment-order-status-stream';

describe('ensureShipmentOrderStatusStream', () => {
  it('creates the stream when it does not exist yet', async () => {
    const add = jest.fn().mockResolvedValue(undefined);
    const jsm = { streams: { add } } as never;

    await ensureShipmentOrderStatusStream(jsm);

    expect(add).toHaveBeenCalledWith(
      expect.objectContaining({
        name: 'SHIPMENT_ORDER_STATUS',
        subjects: ['shipment_orders.status.>'],
      }),
    );
  });

  it('swallows the error when the stream already exists', async () => {
    const add = jest
      .fn()
      .mockRejectedValue(new Error('stream name already in use'));
    const jsm = { streams: { add } } as never;

    await expect(ensureShipmentOrderStatusStream(jsm)).resolves.toBeUndefined();
  });

  it('rethrows any other error', async () => {
    const add = jest.fn().mockRejectedValue(new Error('connection refused'));
    const jsm = { streams: { add } } as never;

    await expect(ensureShipmentOrderStatusStream(jsm)).rejects.toThrow(
      'connection refused',
    );
  });
});
