import { OrderLookupAdapter } from './order-lookup.adapter';

describe('OrderLookupAdapter', () => {
  let shipmentOrderRepository: { findOne: jest.Mock };
  let parcelRepository: { find: jest.Mock; findOne: jest.Mock };
  let adapter: OrderLookupAdapter;

  beforeEach(() => {
    shipmentOrderRepository = { findOne: jest.fn() };
    parcelRepository = { find: jest.fn(), findOne: jest.fn() };
    adapter = new OrderLookupAdapter(
      shipmentOrderRepository as never,
      parcelRepository as never,
    );
  });

  it('returns null when the shipment_order_id does not exist', async () => {
    shipmentOrderRepository.findOne.mockResolvedValue(null);

    const result = await adapter.findParcelsByShipmentOrderId('missing-id');

    expect(result).toBeNull();
    expect(parcelRepository.find).not.toHaveBeenCalled();
  });

  it('returns the parcels (id + state) belonging to an existing order', async () => {
    shipmentOrderRepository.findOne.mockResolvedValue({ id: 'order-1' });
    parcelRepository.find.mockResolvedValue([
      { id: 'parcel-1', shipmentOrderId: 'order-1', state: 'InTransit' },
      { id: 'parcel-2', shipmentOrderId: 'order-1', state: 'Delivered' },
    ]);

    const result = await adapter.findParcelsByShipmentOrderId('order-1');

    expect(result).toEqual([
      { id: 'parcel-1', state: 'InTransit' },
      { id: 'parcel-2', state: 'Delivered' },
    ]);
  });

  it('resolves the shipment_order_id for a given parcel_id', async () => {
    parcelRepository.findOne.mockResolvedValue({
      id: 'parcel-1',
      shipmentOrderId: 'order-1',
    });

    const result = await adapter.findShipmentOrderIdByParcelId('parcel-1');

    expect(result).toBe('order-1');
  });

  it('returns null when the parcel_id does not resolve to any order', async () => {
    parcelRepository.findOne.mockResolvedValue(null);

    const result = await adapter.findShipmentOrderIdByParcelId('unknown');

    expect(result).toBeNull();
  });

  it('resolves the shipment_order_id for a given share_token', async () => {
    shipmentOrderRepository.findOne.mockResolvedValue({
      id: 'order-1',
      shareToken: 'token-1',
    });

    const result = await adapter.findShipmentOrderIdByShareToken('token-1');

    expect(shipmentOrderRepository.findOne).toHaveBeenCalledWith({
      where: { shareToken: 'token-1' },
    });
    expect(result).toBe('order-1');
  });

  it('returns null when the share_token does not resolve to any order', async () => {
    shipmentOrderRepository.findOne.mockResolvedValue(null);

    const result = await adapter.findShipmentOrderIdByShareToken('unknown');

    expect(result).toBeNull();
  });
});
