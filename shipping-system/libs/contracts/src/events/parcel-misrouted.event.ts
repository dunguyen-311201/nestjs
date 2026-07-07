import { BaseEventV1 } from '../base-event';

/** Published by Hub on `parcel.misrouted` (off-route hub scan, BR-02). Consumed by Tracking, Order. */
export interface ParcelMisroutedEventV1 extends BaseEventV1 {
  parcel_id: string;
  scanned_hub_id: string;
}
