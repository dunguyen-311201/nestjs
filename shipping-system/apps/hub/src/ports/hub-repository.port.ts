export interface HubRecord {
  id: string;
  zoneId: string;
}

export interface RouteRecord {
  id: string;
  originZoneId: string;
  destZoneId: string;
}

export interface OutboxEventInput {
  eventId: string;
  eventType: string;
  payload: Record<string, unknown>;
}

export abstract class IHubRepository {
  abstract findHubById(hubId: string): Promise<HubRecord | null>;
  abstract findRouteById(routeId: string): Promise<RouteRecord | null>;
  abstract findRouteByZones(
    originZoneId: string,
    destZoneId: string,
  ): Promise<RouteRecord | null>;

  // Writes 1 or 2 OUTBOX rows atomically (2 only for the misrouted +
  // corrective-republish case, BR-02) - this endpoint owns no other
  // business row, so recording a scan is purely an Outbox write.
  abstract recordScan(events: OutboxEventInput[]): Promise<void>;
}
