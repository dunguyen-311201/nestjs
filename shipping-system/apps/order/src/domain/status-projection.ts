import { ParcelState } from '../entities/parcel.enums';
import { ShipmentOrderStatus } from '../entities/shipment-order-status.enum';

const TERMINAL_STATES: ReadonlySet<ParcelState> = new Set([
  ParcelState.DELIVERED,
  ParcelState.LOST,
  ParcelState.DAMAGED,
]);

// SHIPMENT_ORDER.status is a materialized projection of the least-advanced
// status among its parcels. The mapping table implemented here is the
// agreed status-projection mapping - not derivable from that one-line
// principle alone.
export function computeOrderStatus(
  parcelStates: ParcelState[],
): ShipmentOrderStatus {
  if (parcelStates.length === 0) {
    throw new Error('Cannot compute order status with no parcels');
  }

  const allTerminal = parcelStates.every((state) => TERMINAL_STATES.has(state));
  if (!allTerminal) {
    return ShipmentOrderStatus.ACTIVE;
  }

  const allDelivered = parcelStates.every(
    (state) => state === ParcelState.DELIVERED,
  );
  if (allDelivered) {
    return ShipmentOrderStatus.COMPLETE;
  }

  const allLost = parcelStates.every((state) => state === ParcelState.LOST);
  if (allLost) {
    return ShipmentOrderStatus.LOST;
  }

  const allDamaged = parcelStates.every(
    (state) => state === ParcelState.DAMAGED,
  );
  if (allDamaged) {
    return ShipmentOrderStatus.DAMAGED;
  }

  return ShipmentOrderStatus.PARTIALLY_DELIVERED;
}
