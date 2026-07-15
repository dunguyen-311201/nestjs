import { BaseEventV1 } from '../base-event';

/**
 * Published by Line-haul on `parcel.loaded_for_linehaul`, from
 * `/trips/{id}/depart` (task 7.3) - one event per parcel_id stored on the
 * trip. Consumed by Order (advances PARCEL.state via DEPARTED_LINEHAUL) and
 * Tracking. The docblock previously said "Published by Hub", which was
 * never actually implemented anywhere and predates the current per-service
 * split - fixed to match reality.
 */
export interface ParcelLoadedForLinehaulEventV1 extends BaseEventV1 {
  parcel_id: string;
  linehaul_trip_id: string;
}
