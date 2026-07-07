import { BaseEventV1 } from '../base-event';

/** Published by Hub on `parcel.hub_received` (HUB_RECEIVE scan). Consumed by Tracking, Order. */
export interface ParcelHubReceivedEventV1 extends BaseEventV1 {
  parcel_id: string;
  hub_id: string;
  actual_weight_grams: number;
}
