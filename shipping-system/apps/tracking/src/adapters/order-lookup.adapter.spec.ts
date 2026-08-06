import { OrderLookupAdapter } from './order-lookup.adapter';

describe('OrderLookupAdapter', () => {
  let shipmentOrderRepository: { findOne: jest.Mock; find: jest.Mock };
  let parcelRepository: { find: jest.Mock; findOne: jest.Mock };
  let adapter: OrderLookupAdapter;

  beforeEach(() => {
    shipmentOrderRepository = { findOne: jest.fn(), find: jest.fn() };
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

  describe('findSlaBreachedParcelIds', () => {
    it('returns ids of non-terminal parcels belonging to SLA-breached orders', async () => {
      shipmentOrderRepository.find.mockResolvedValue([
        { id: 'order-1' },
        { id: 'order-2' },
      ]);
      parcelRepository.find.mockResolvedValue([
        { id: 'parcel-1', shipmentOrderId: 'order-1', state: 'InTransit' },
        { id: 'parcel-2', shipmentOrderId: 'order-2', state: 'OutForDelivery' },
      ]);

      const now = new Date('2026-08-06T00:00:00Z');
      const result = await adapter.findSlaBreachedParcelIds(now);

      expect(result).toEqual(['parcel-1', 'parcel-2']);
    });

    it('returns an empty array without querying parcels when no order has breached its SLA', async () => {
      shipmentOrderRepository.find.mockResolvedValue([]);

      const result = await adapter.findSlaBreachedParcelIds(new Date());

      expect(result).toEqual([]);
      expect(parcelRepository.find).not.toHaveBeenCalled();
    });
  });
});
