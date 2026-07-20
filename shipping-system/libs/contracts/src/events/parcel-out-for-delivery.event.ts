import { BaseEventV1 } from '../base-event';

/**
 * Published by Dispatcher on `parcel.out_for_delivery`, from
 * `POST /parcels/{id}/assign-courier` (task 7.3) - assigning a courier to the final
 * leg is the moment a parcel becomes ready for last-mile dispatch.
 * Consumed by Tracking, Order. The docblock previously said "Published by
 * Courier", which was never actually implemented anywhere and predates the
 * current per-service split - fixed to match reality.
 */
export interface ParcelOutForDeliveryEventV1 extends BaseEventV1 {
  parcel_id: string;
  courier_id: string;
}
