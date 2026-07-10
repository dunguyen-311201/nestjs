import { OrderLookupAdapter } from './order-lookup.adapter';

describe('OrderLookupAdapter', () => {
  let shipmentOrderRepository: { findOne: jest.Mock };
  let parcelRepository: { find: jest.Mock };
  let adapter: OrderLookupAdapter;

  beforeEach(() => {
    shipmentOrderRepository = { findOne: jest.fn() };
    parcelRepository = { find: jest.fn() };
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
});
