/**
 * NATS subject constants for every event this system publishes/consumes.
 * Producers and consumers should reference these rather than hardcoding
 * subject strings.
 */
export const NATS_SUBJECTS = {
  ORDER_CREATED: 'order.created',
  PAYMENT_SUCCEEDED: 'payment.succeeded',
  PARCEL_PICKED_UP: 'parcel.picked_up',
  PARCEL_HUB_RECEIVED: 'parcel.hub_received',
  PARCEL_LOADED_FOR_LINEHAUL: 'parcel.loaded_for_linehaul',
  PARCEL_ARRIVED_AT_HUB: 'parcel.arrived_at_hub',
  TRIP_DEPARTED: 'trip.departed',
  TRIP_ARRIVED: 'trip.arrived',
  PARCEL_MISROUTED: 'parcel.misrouted',
  PARCEL_OUT_FOR_DELIVERY: 'parcel.out_for_delivery',
  PARCEL_DELIVERED: 'parcel.delivered',
  PARCEL_RTS: 'parcel.rts',
  PARCEL_LOST_SUSPECTED: 'parcel.lost_suspected',
} as const;

// Per-order projection-write subject - a recompute trigger, not a domain
// event. `shipment_orders` (not `orders`) to match ADR-001 and
// order-service.md's Diagram 8 exactly.
export const SHIPMENT_ORDER_STATUS_WILDCARD = 'shipment_orders.status.>';

export function orderStatusSubject(shipmentOrderId: string): string {
  return `shipment_orders.status.${shipmentOrderId}`;
}
