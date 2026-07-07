import { BaseEventV1 } from '../base-event';

/** Published by Courier on `parcel.delivered`. Consumed by Tracking, Order, Notification (BR-09). */
export interface ParcelDeliveredEventV1 extends BaseEventV1 {
  parcel_id: string;
  courier_id: string;
  signature_url: string | null;
  photo_url: string | null;
}
