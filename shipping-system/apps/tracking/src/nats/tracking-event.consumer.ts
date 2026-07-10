import {
  Injectable,
  Logger,
  OnModuleDestroy,
  OnModuleInit,
} from '@nestjs/common';
import { connect, JSONCodec, NatsConnection, Subscription } from 'nats';
import { ITrackingEventRepository } from '../ports/tracking-event-repository.port';
import {
  CONSUMED_SUBJECTS,
  mapSubjectToTrackingEvent,
} from './map-subject-to-tracking-event';

const codec = JSONCodec();

// Core NATS subscribe (fire-and-forget) for the parcel-lifecycle event
// store, per task 5.5's scope. JetStream durable/ordered delivery for
// per-order projection serialization (BR-07/ADR-001) is task 5.7's job -
// this consumer only appends TRACKING_EVENT rows.
@Injectable()
export class TrackingEventConsumer implements OnModuleInit, OnModuleDestroy {
  private readonly logger = new Logger(TrackingEventConsumer.name);
  private connection: NatsConnection | null = null;
  private subscriptions: Subscription[] = [];

  constructor(
    private readonly trackingEventRepository: ITrackingEventRepository,
  ) {}

  async onModuleInit(): Promise<void> {
    this.connection = await connect({
      servers: process.env.NATS_URL ?? 'nats://localhost:4222',
    });

    this.subscriptions = CONSUMED_SUBJECTS.map((subject) => {
      const subscription = this.connection!.subscribe(subject);
      void this.consume(subject, subscription);
      return subscription;
    });
  }

  async onModuleDestroy(): Promise<void> {
    for (const subscription of this.subscriptions) {
      subscription.unsubscribe();
    }
    await this.connection?.close();
  }

  private async consume(
    subject: string,
    subscription: Subscription,
  ): Promise<void> {
    for await (const message of subscription) {
      try {
        const payload = codec.decode(message.data);
        const event = mapSubjectToTrackingEvent(
          subject,
          payload as Parameters<typeof mapSubjectToTrackingEvent>[1],
        );
        if (!event) {
          this.logger.warn(`Unrecognized or malformed message on ${subject}`);
          continue;
        }
        await this.trackingEventRepository.appendEvent(event);
      } catch (error) {
        this.logger.error(
          `Failed to process message on ${subject}: ${(error as Error).message}`,
        );
      }
    }
  }
}
