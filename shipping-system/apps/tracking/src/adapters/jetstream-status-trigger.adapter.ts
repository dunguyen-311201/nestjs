import { Inject, Injectable } from '@nestjs/common';
import type { JetStreamClient } from 'nats';
import { orderStatusSubject } from '@app/contracts';
import { IStatusTriggerPublisher } from '../ports/status-trigger-publisher.port';
import { JETSTREAM_CLIENT } from '../nats/jetstream-client.provider';

// The shipment_orders.status.<id> trigger is published over real JetStream
// (not @nestjs/microservices' NATS-core transport - the built-in
// transporter can't speak JetStream), so it is persisted and durably
// delivered to Order's ordered per-subject consumer.
@Injectable()
export class JetStreamStatusTriggerPublisher implements IStatusTriggerPublisher {
  constructor(@Inject(JETSTREAM_CLIENT) private readonly js: JetStreamClient) {}

  async publish(shipmentOrderId: string): Promise<void> {
    await this.js.publish(
      orderStatusSubject(shipmentOrderId),
      new TextEncoder().encode('{}'),
    );
  }
}
