export abstract class IStatusCachePort {
  // Reads the SHIPMENT_ORDER.status Redis cache (write-through, populated
  // by Order's projection consumer). Returns null on a cache miss -
  // callers should not fall back to a synchronous cross-service Postgres
  // read for this field.
  abstract getStatus(shipmentOrderId: string): Promise<string | null>;
}
