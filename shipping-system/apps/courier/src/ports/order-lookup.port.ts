export interface ParcelOrderContext {
  shipmentOrderId: string;
  orderStatus: string;
  parcelDirection: string;
}

export abstract class IOrderLookupPort {
  // Returns null when parcel_id doesn't exist (-> 404 at the service).
  // Used by both pickup (BR-08 guard on orderStatus) and deliver
  // (existence check only) to resolve a parcel's parent order.
  abstract findParcelOrderContext(
    parcelId: string,
  ): Promise<ParcelOrderContext | null>;
}
