import { BaseEventV1 } from '../base-event';

/**
 * Published by Hub on `parcel.hub_received` (HUB_RECEIVE scan). Consumed by
 * Tracking, Order. `route_id` is set only on the corrective republish after
 * a misrouted scan (BR-02) - Order's ParcelEventConsumer applies it to
 * PARCEL.route_id alongside its state transition, since Hub never writes
 * cross-schema.
 */
export interface ParcelHubReceivedEventV1 extends BaseEventV1 {
  parcel_id: string;
  hub_id: string;
  actual_weight_grams: number;
  route_id?: string;
}
