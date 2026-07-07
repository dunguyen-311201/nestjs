/**
 * Every NATS event shares this envelope. `event_id` doubles as the JetStream
 * `Nats-Msg-Id` header value for broker-level dedup (see docs/02-HLD.md
 * "Idempotency and outbox mechanics"); consumers also de-dup on it.
 */
export interface BaseEventV1 {
  event_id: string;
  occurred_at: string; // ISO-8601 UTC
}
