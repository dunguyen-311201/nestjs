/**
 * NATS subject constants, matching docs/02-HLD.md "NATS Subject Map".
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

/** Per-order projection-write subject (not a domain event - see docs/02-HLD.md). */
export function orderStatusSubject(orderId: string): string {
  return `orders.status.${orderId}`;
}
