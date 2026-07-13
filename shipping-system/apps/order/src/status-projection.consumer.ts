import {
  Injectable,
  Inject,
  Logger,
  OnModuleInit,
  OnModuleDestroy,
  Optional,
} from '@nestjs/common';
import { AckPolicy } from 'nats';
import type { JetStreamManager, JsMsg, NatsConnection } from 'nats';
import Redis from 'ioredis';
import { IOrderRepository } from './ports/order-repository.port';
import { computeOrderStatus } from './domain/status-projection';
import { REDIS_CLIENT } from './adapters/redis-idempotency.adapter';
import { ensureShipmentOrderStatusStream } from './nats/ensure-shipment-order-status-stream';

const DEFAULT_DEBOUNCE_MS = 300;
const DURABLE_CONSUMER_NAME = 'order-status-projection';

function statusCacheKey(shipmentOrderId: string): string {
  return `order:status:${shipmentOrderId}`;
}

// ADR-001/BR-07: the shipment_orders.status.<id> trigger runs over real
// JetStream (durable, ordered per-subject consumer with explicit ack), not
// @nestjs/microservices' NATS-core transport - ADR-005 notes the built-in
// transporter can't speak JetStream. Diagram 8 (docs/lld/order-service.md):
// debounces bursts of recompute triggers (published by Tracking after each
// scan) per shipment_order_id, so a hub processing hundreds of parcels in
// one order doesn't recompute the same order's projection hundreds of times.
@Injectable()
export class StatusProjectionConsumer implements OnModuleInit, OnModuleDestroy {
  private readonly logger = new Logger(StatusProjectionConsumer.name);
  private readonly timers = new Map<string, ReturnType<typeof setTimeout>>();
  private connection: NatsConnection | null = null;

  constructor(
    private readonly orderRepository: IOrderRepository,
    @Inject(REDIS_CLIENT) private readonly redis: Redis,
    @Optional() private readonly debounceMs: number = DEFAULT_DEBOUNCE_MS,
  ) {}

  async onModuleInit(): Promise<void> {
    const { connect } = await import('nats');
    this.connection = await connect({
      servers: [process.env.NATS_URL ?? 'nats://localhost:4222'],
    });
    const jsm: JetStreamManager = await this.connection.jetstreamManager();
    await ensureShipmentOrderStatusStream(jsm);

    const js = this.connection.jetstream();
    const consumer = await js.consumers.get(
      'SHIPMENT_ORDER_STATUS',
      await this.ensureConsumer(jsm),
    );
    void this.consumeMessages(consumer);
  }

  private async ensureConsumer(jsm: JetStreamManager): Promise<string> {
    await jsm.consumers.add('SHIPMENT_ORDER_STATUS', {
      durable_name: DURABLE_CONSUMER_NAME,
      ack_policy: AckPolicy.Explicit,
    });
    return DURABLE_CONSUMER_NAME;
  }

  private async consumeMessages(consumer: {
    consume: () => AsyncIterable<JsMsg>;
  }): Promise<void> {
    const messages = await consumer.consume();
    for await (const message of messages) {
      this.handleMessage(message);
    }
  }

  async onModuleDestroy(): Promise<void> {
    await this.connection?.close();
  }

  handleMessage(message: JsMsg): void {
    const shipmentOrderId = message.subject.split('.').pop();
    if (shipmentOrderId) {
      this.scheduleRecompute(shipmentOrderId);
    }
    message.ack();
  }

  scheduleRecompute(shipmentOrderId: string): void {
    const existing = this.timers.get(shipmentOrderId);
    if (existing) {
      clearTimeout(existing);
    }
    const timer = setTimeout(() => {
      this.timers.delete(shipmentOrderId);
      void this.recompute(shipmentOrderId);
    }, this.debounceMs);
    this.timers.set(shipmentOrderId, timer);
  }

  async recompute(shipmentOrderId: string): Promise<void> {
    const parcelStates =
      await this.orderRepository.findParcelStatesByShipmentOrderId(
        shipmentOrderId,
      );
    if (!parcelStates || parcelStates.length === 0) {
      this.logger.warn(
        `No parcels found for shipment_order_id ${shipmentOrderId}, skipping recompute`,
      );
      return;
    }

    const status = computeOrderStatus(parcelStates);
    await this.orderRepository.updateShipmentOrderStatus(
      shipmentOrderId,
      status,
    );
    await this.redis.set(statusCacheKey(shipmentOrderId), status);
  }
}
