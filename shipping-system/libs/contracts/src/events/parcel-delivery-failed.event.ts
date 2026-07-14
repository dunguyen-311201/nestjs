import { BaseEventV1 } from '../base-event';

/**
 * Published by Courier on `parcel.delivery_failed` for each failed delivery
 * attempt (1st and 2nd; the 3rd also triggers `parcel.rts`, BR-04).
 * Consumed by Tracking (appends a `DELIVERY_FAILED` scan event).
 */
export interface ParcelDeliveryFailedEventV1 extends BaseEventV1 {
  parcel_id: string;
  courier_id: string;
  failure_reason: string;
}
