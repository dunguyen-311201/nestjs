import {
  Injectable,
  Logger,
  OnModuleDestroy,
  OnModuleInit,
} from '@nestjs/common';
import { IOutboxRepository } from './ports/outbox-repository.port';
import { IEventPublisher } from './ports/event-publisher.port';
import { CircuitBreaker, CircuitState } from './circuit-breaker';

const POLL_INTERVAL_MS = 500;
const BATCH_SIZE = 20;

// After 5 consecutive publish failures (e.g. NATS down), stop attempting
// for 5s, doubling up to 60s on repeated failure - see circuit-breaker.ts.
const CIRCUIT_FAILURE_THRESHOLD = 5;
const CIRCUIT_INITIAL_COOLDOWN_MS = 5000;
const CIRCUIT_MAX_COOLDOWN_MS = 60000;

@Injectable()
export class OutboxPollerService implements OnModuleInit, OnModuleDestroy {
  private readonly logger = new Logger(OutboxPollerService.name);
  private interval: ReturnType<typeof setInterval> | null = null;
  private polling = false;
  private readonly circuitBreaker = new CircuitBreaker({
    failureThreshold: CIRCUIT_FAILURE_THRESHOLD,
    initialCooldownMs: CIRCUIT_INITIAL_COOLDOWN_MS,
    maxCooldownMs: CIRCUIT_MAX_COOLDOWN_MS,
  });

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
    if (this.polling) {
      return;
    }
    if (!this.circuitBreaker.canAttempt()) {
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
          this.circuitBreaker.onSuccess();
        } catch (error) {
          this.logger.error(
            `Failed to publish outbox row ${row.id}: ${(error as Error).message}`,
          );
          this.circuitBreaker.onFailure();
          if (this.circuitBreaker.getState() === CircuitState.OPEN) {
            this.logger.warn(
              'Circuit breaker open - pausing outbox publishing until the cooldown elapses',
            );
            break;
          }
        }
      }
    } finally {
      this.polling = false;
    }
  }
}
