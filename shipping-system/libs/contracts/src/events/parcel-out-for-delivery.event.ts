import { BaseEventV1 } from '../base-event';

/** Published by Courier on `parcel.out_for_delivery`. Consumed by Tracking, Order. */
export interface ParcelOutForDeliveryEventV1 extends BaseEventV1 {
  parcel_id: string;
  courier_id: string;
}
