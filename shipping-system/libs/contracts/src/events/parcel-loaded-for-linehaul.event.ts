import { BaseEventV1 } from '../base-event';

/** Published by Hub on `parcel.loaded_for_linehaul`. Consumed by Tracking. */
export interface ParcelLoadedForLinehaulEventV1 extends BaseEventV1 {
  parcel_id: string;
  linehaul_trip_id: string;
}
