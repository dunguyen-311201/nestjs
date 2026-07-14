export interface ParcelOrderContext {
  shipmentOrderId: string;
  orderStatus: string;
  routeId: string | null;
}

export abstract class IOrderLookupPort {
  // Returns null when parcel_id doesn't exist (-> 404 at the service).
  abstract findParcelOrderContext(
    parcelId: string,
  ): Promise<ParcelOrderContext | null>;
}
