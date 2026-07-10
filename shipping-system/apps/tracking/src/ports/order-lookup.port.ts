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
}
