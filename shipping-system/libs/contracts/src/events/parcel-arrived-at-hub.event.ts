import { BaseEventV1 } from '../base-event';

/** Published by Hub on `parcel.arrived_at_hub` (destination hub inbound). Consumed by Tracking, Order. */
export interface ParcelArrivedAtHubEventV1 extends BaseEventV1 {
  parcel_id: string;
  hub_id: string;
  linehaul_trip_id: string;
}
