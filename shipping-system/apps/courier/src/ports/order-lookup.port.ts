export interface ParcelOrderContext {
  shipmentOrderId: string;
  orderStatus: string;
  parcelDirection: string;
  // Last-mile courier assignment (null until Dispatcher's leg-assign event
  // lands); read for shipper ownership enforcement on /deliver.
  assignedCourierId: string | null;
}

export abstract class IOrderLookupPort {
  // Returns null when parcel_id doesn't exist (-> 404 at the service).
  // Used by both pickup (paid-order guard on orderStatus) and deliver
  // (existence check only) to resolve a parcel's parent order.
  abstract findParcelOrderContext(
    parcelId: string,
  ): Promise<ParcelOrderContext | null>;
}
