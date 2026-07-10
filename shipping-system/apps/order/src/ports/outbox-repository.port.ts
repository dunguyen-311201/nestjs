import { Outbox } from '../entities/outbox.entity';

export abstract class IOutboxRepository {
  abstract findPendingBatch(limit: number): Promise<Outbox[]>;
  abstract markPublished(id: string): Promise<void>;
}
