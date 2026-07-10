import { computeOrderStatus } from './status-projection';
import { ParcelState } from '../entities/parcel.enums';
import { ShipmentOrderStatus } from '../entities/shipment-order-status.enum';

describe('computeOrderStatus (BR-05)', () => {
  it('returns Active when at least one parcel is still non-terminal', () => {
    expect(
      computeOrderStatus([ParcelState.DELIVERED, ParcelState.IN_TRANSIT]),
    ).toBe(ShipmentOrderStatus.ACTIVE);
    expect(computeOrderStatus([ParcelState.MISROUTED])).toBe(
      ShipmentOrderStatus.ACTIVE,
    );
    expect(computeOrderStatus([ParcelState.CREATED])).toBe(
      ShipmentOrderStatus.ACTIVE,
    );
    expect(computeOrderStatus([ParcelState.OUT_FOR_DELIVERY])).toBe(
      ShipmentOrderStatus.ACTIVE,
    );
  });

  it('returns Complete when every parcel is Delivered', () => {
    expect(
      computeOrderStatus([ParcelState.DELIVERED, ParcelState.DELIVERED]),
    ).toBe(ShipmentOrderStatus.COMPLETE);
  });

  it('returns Partially_Delivered when all terminal but mixed (not all Delivered)', () => {
    expect(computeOrderStatus([ParcelState.DELIVERED, ParcelState.LOST])).toBe(
      ShipmentOrderStatus.PARTIALLY_DELIVERED,
    );
    expect(computeOrderStatus([ParcelState.LOST, ParcelState.DAMAGED])).toBe(
      ShipmentOrderStatus.PARTIALLY_DELIVERED,
    );
  });

  it('returns Lost when every parcel is Lost', () => {
    expect(computeOrderStatus([ParcelState.LOST, ParcelState.LOST])).toBe(
      ShipmentOrderStatus.LOST,
    );
  });

  it('returns Damaged when every parcel is Damaged', () => {
    expect(computeOrderStatus([ParcelState.DAMAGED, ParcelState.DAMAGED])).toBe(
      ShipmentOrderStatus.DAMAGED,
    );
  });

  it('throws when given an empty parcel list (should never happen - BR-01 requires >= 1 parcel)', () => {
    expect(() => computeOrderStatus([])).toThrow();
  });
});
