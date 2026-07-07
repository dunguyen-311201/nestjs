import { BaseEventV1 } from '../base-event';

/** Published by Order on `order.created`. Consumed by Tracking, Pricing (audit), Notification. */
export interface OrderCreatedEventV1 extends BaseEventV1 {
  order_id: string;
  sender_id: string;
  recipient_id: string;
  parcel_ids: string[];
}
