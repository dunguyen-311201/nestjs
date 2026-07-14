import { OrderLookupAdapter } from './order-lookup.adapter';

describe('OrderLookupAdapter', () => {
  let findOneParcel: jest.Mock;
  let findOneOrder: jest.Mock;
  let parcelRepository: { findOne: jest.Mock };
  let shipmentOrderRepository: { findOne: jest.Mock };
  let adapter: OrderLookupAdapter;

  beforeEach(() => {
    findOneParcel = jest.fn();
    findOneOrder = jest.fn();
    parcelRepository = { findOne: findOneParcel };
    shipmentOrderRepository = { findOne: findOneOrder };
    adapter = new OrderLookupAdapter(
      parcelRepository as never,
      shipmentOrderRepository as never,
    );
  });

  it('returns null when the parcel does not exist', async () => {
    findOneParcel.mockResolvedValue(null);

    const result = await adapter.findParcelOrderContext('parcel-1');

    expect(result).toBeNull();
    expect(findOneOrder).not.toHaveBeenCalled();
  });

  it('resolves shipmentOrderId + orderStatus + routeId for an existing parcel', async () => {
    findOneParcel.mockResolvedValue({
      id: 'parcel-1',
      shipmentOrderId: 'order-1',
      routeId: 'route-1',
    });
    findOneOrder.mockResolvedValue({ id: 'order-1', status: 'Confirmed' });

    const result = await adapter.findParcelOrderContext('parcel-1');

    expect(result).toEqual({
      shipmentOrderId: 'order-1',
      orderStatus: 'Confirmed',
      routeId: 'route-1',
    });
  });

  it('resolves routeId as null when the parcel has no route assigned', async () => {
    findOneParcel.mockResolvedValue({
      id: 'parcel-1',
      shipmentOrderId: 'order-1',
      routeId: null,
    });
    findOneOrder.mockResolvedValue({ id: 'order-1', status: 'Confirmed' });

    const result = await adapter.findParcelOrderContext('parcel-1');

    expect(result?.routeId).toBeNull();
  });
});
