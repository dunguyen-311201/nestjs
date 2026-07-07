import { BaseEventV1 } from '../base-event';

/** Published by Order on `payment.succeeded`. Consumed by Order, Tracking, Notification. */
export interface PaymentSucceededEventV1 extends BaseEventV1 {
  order_id: string;
  payment_id: string;
}
