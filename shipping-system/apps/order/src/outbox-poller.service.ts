import {
  Injectable,
  Logger,
  OnModuleDestroy,
  OnModuleInit,
} from '@nestjs/common';
import { IOutboxRepository } from './ports/outbox-repository.port';
import { IEventPublisher } from './ports/event-publisher.port';

const POLL_INTERVAL_MS = 500;
const BATCH_SIZE = 20;

@Injectable()
export class OutboxPollerService implements OnModuleInit, OnModuleDestroy {
  private readonly logger = new Logger(OutboxPollerService.name);
  private interval: ReturnType<typeof setInterval> | null = null;
  private polling = false;

  constructor(
    private readonly outboxRepository: IOutboxRepository,
    private readonly eventPublisher: IEventPublisher,
  ) {}

  onModuleInit(): void {
    this.interval = setInterval(() => void this.pollOnce(), POLL_INTERVAL_MS);
  }

  onModuleDestroy(): void {
    if (this.interval) {
      clearInterval(this.interval);
    }
  }

  async pollOnce(): Promise<void> {
    // A previous poll tick may still be in flight (e.g. a slow NATS
    // publish); skip this tick rather than running two batches
    // concurrently against the same PENDING rows.
    if (this.polling) {
      return;
    }
    this.polling = true;
    try {
      const rows = await this.outboxRepository.findPendingBatch(BATCH_SIZE);
      for (const row of rows) {
        try {
          await this.eventPublisher.publish(
            row.eventType,
            row.eventId,
            row.payload,
          );
          await this.outboxRepository.markPublished(row.id);
        } catch (error) {
          this.logger.error(
            `Failed to publish outbox row ${row.id}: ${(error as Error).message}`,
          );
        }
      }
    } finally {
      this.polling = false;
    }
  }
}
