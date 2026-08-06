export interface OrderParcelSummary {
  id: string;
  state: string;
}

export abstract class IOrderLookupPort {
  // Returns null when the shipment_order_id doesn't exist (-> 404 at the
  // controller); an empty array is a valid result for an order with no
  // parcels resolved yet.
  abstract findParcelsByShipmentOrderId(
    shipmentOrderId: string,
  ): Promise<OrderParcelSummary[] | null>;

  // Used by TrackingEventConsumer to resolve which order's status
  // projection to trigger a recompute for, after appending a scan event.
  abstract findShipmentOrderIdByParcelId(
    parcelId: string,
  ): Promise<string | null>;

  // Recipient share-link: resolves an unauthenticated recipient's opaque
  // share_token to the shipment_order_id it belongs to.
  abstract findShipmentOrderIdByShareToken(
    shareToken: string,
  ): Promise<string | null>;

  // UC-15 passive lost-parcel sweep: parcels whose order's
  // expected_delivery_at is already in the past and whose state hasn't
  // reached a terminal one yet (Delivered/Lost/Damaged) - once a parcel is
  // flagged Lost it naturally drops out of future sweeps.
  abstract findSlaBreachedParcelIds(now: Date): Promise<string[]>;
}
