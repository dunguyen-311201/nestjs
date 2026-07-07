import { BaseEventV1 } from '../base-event';

/** Published by Line-haul on `trip.departed`. Consumed by Tracking. */
export interface TripDepartedEventV1 extends BaseEventV1 {
  linehaul_trip_id: string;
  origin_hub_id: string;
}
