import { BaseEventV1 } from '../base-event';

/**
 * Published by Tracking's passive lost-parcel detection job on
 * `parcel.lost_suspected` (SLA threshold breached with no next scan).
 * Consumed by Order, Notification.
 */
export interface ParcelLostSuspectedEventV1 extends BaseEventV1 {
  parcel_id: string;
  last_scan_type: string;
  last_scan_at: string;
}
