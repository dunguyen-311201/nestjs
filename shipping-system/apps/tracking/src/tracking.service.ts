import { Injectable, NotFoundException } from '@nestjs/common';
import { IOrderLookupPort } from './ports/order-lookup.port';
import { ITrackingEventRepository } from './ports/tracking-event-repository.port';
import { IStatusCachePort } from './ports/status-cache.port';
import { TrackingEvent } from './entities/tracking-event.entity';

export interface TrackingTimelineEntry {
  event_type: TrackingEvent['eventType'];
  created_at: Date;
  hub_id: string | null;
  courier_id: string | null;
  linehaul_trip_id: string | null;
}

export interface TrackingResult {
  shipment_order_id: string;
  status: string | null;
  parcels: {
    parcel_id: string;
    state: string;
    timeline: TrackingTimelineEntry[];
  }[];
}

@Injectable()
export class TrackingService {
  constructor(
    private readonly orderLookupPort: IOrderLookupPort,
    private readonly trackingEventRepository: ITrackingEventRepository,
    private readonly statusCachePort: IStatusCachePort,
  ) {}

  async getTracking(shipmentOrderId: string): Promise<TrackingResult> {
    const parcels =
      await this.orderLookupPort.findParcelsByShipmentOrderId(shipmentOrderId);
    if (!parcels) {
      throw new NotFoundException(
        `No shipment order found for id ${shipmentOrderId}`,
      );
    }

    const [timeline, status] = await Promise.all([
      this.trackingEventRepository.findTimelineByParcelIds(
        parcels.map((parcel) => parcel.id),
      ),
      this.statusCachePort.getStatus(shipmentOrderId),
    ]);

    return {
      shipment_order_id: shipmentOrderId,
      // Redis cache miss (order created but Order's projection consumer
      // hasn't recomputed yet) is a valid transient state, not an error -
      // surfaces as null rather than falling back to a synchronous
      // cross-service Postgres read.
      status,
      parcels: parcels.map((parcel) => ({
        parcel_id: parcel.id,
        state: parcel.state,
        timeline: timeline
          .filter((event) => event.parcelId === parcel.id)
          .map((event) => ({
            event_type: event.eventType,
            created_at: event.createdAt,
            hub_id: event.hubId,
            courier_id: event.courierId,
            linehaul_trip_id: event.linehaulTripId,
          })),
      })),
    };
  }
}
