export abstract class IStatusCachePort {
  // Reads the SHIPMENT_ORDER.status Redis cache (write-through, populated
  // by Order's projection consumer, task 5.6). Returns null on a cache
  // miss - callers should not fall back to a synchronous cross-service
  // Postgres read for this field (docs/lld/tracking-service.md).
  abstract getStatus(shipmentOrderId: string): Promise<string | null>;
}
