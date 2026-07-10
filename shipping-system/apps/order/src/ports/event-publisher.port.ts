export abstract class IEventPublisher {
  // subject/eventId/payload map 1:1 onto an OUTBOX row's event_type/event_id/
  // payload; eventId is set as the NATS `Nats-Msg-Id` header for broker-level
  // dedup (layer 1 of the two-layer idempotency convention).
  abstract publish(
    subject: string,
    eventId: string,
    payload: Record<string, unknown>,
  ): Promise<void>;
}
