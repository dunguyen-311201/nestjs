import { BaseEventV1 } from '../base-event';

/** Published by Line-haul on `trip.arrived`. Consumed by Tracking, Hub. */
export interface TripArrivedEventV1 extends BaseEventV1 {
  linehaul_trip_id: string;
  dest_hub_id: string;
}
