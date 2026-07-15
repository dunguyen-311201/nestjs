import { Outbox } from '../entities/outbox.entity';

export interface OutboxEventInput {
  eventId: string;
  eventType: string;
  payload: Record<string, unknown>;
}

export abstract class IOutboxRepository {
  // No domain row to combine this with (assignLeg is validation-only, task
  // 6.5) - just the outbox write itself, unlike Hub/Line-haul's
  // one-transaction-with-a-status-update pattern.
  abstract insert(event: OutboxEventInput): Promise<void>;
  abstract findPendingBatch(limit: number): Promise<Outbox[]>;
  abstract markPublished(id: string): Promise<void>;
}
