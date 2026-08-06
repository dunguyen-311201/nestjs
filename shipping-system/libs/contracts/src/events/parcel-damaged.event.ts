import { BaseEventV1 } from '../base-event';

/** Published by Hub on `parcel.damaged` (hub staff reports physical damage during a scan, in place of the normal receive scan). Consumed by Tracking, Order. */
export interface ParcelDamagedEventV1 extends BaseEventV1 {
  parcel_id: string;
  hub_id: string;
}
