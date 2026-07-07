import { BaseEventV1 } from '../base-event';

/** Published by Courier on `parcel.picked_up`. Consumed by Tracking, Order. */
export interface ParcelPickedUpEventV1 extends BaseEventV1 {
  parcel_id: string;
  courier_id: string;
}
