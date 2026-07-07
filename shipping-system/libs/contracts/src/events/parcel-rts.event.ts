import { BaseEventV1 } from '../base-event';

/**
 * Published by Courier on `parcel.rts` after the 3rd failed delivery attempt
 * (BR-04). Consumed by Tracking, Order, Notification. Sets
 * `PARCEL.direction = Reverse_RTS` and resets the failed-attempt counter for
 * the reverse leg.
 */
export interface ParcelRtsEventV1 extends BaseEventV1 {
  parcel_id: string;
}
