import { Controller, Inject, Logger, Optional } from '@nestjs/common';
import { Ctx, EventPattern, NatsContext } from '@nestjs/microservices';
import Redis from 'ioredis';
import { SHIPMENT_ORDER_STATUS_WILDCARD } from '@app/contracts';
import { IOrderRepository } from './ports/order-repository.port';
import { computeOrderStatus } from './domain/status-projection';
import { REDIS_CLIENT } from './adapters/redis-idempotency.adapter';

const DEFAULT_DEBOUNCE_MS = 300;

function statusCacheKey(shipmentOrderId: string): string {
  return `order:status:${shipmentOrderId}`;
}

// Diagram 8 (docs/lld/order-service.md): debounces bursts of recompute
// triggers (published by Tracking after each scan) per shipment_order_id,
// so a hub processing hundreds of parcels in one order doesn't recompute
// the same order's projection hundreds of times.
@Controller()
export class StatusProjectionConsumer {
  private readonly logger = new Logger(StatusProjectionConsumer.name);
  private readonly timers = new Map<string, ReturnType<typeof setTimeout>>();

  constructor(
    private readonly orderRepository: IOrderRepository,
    @Inject(REDIS_CLIENT) private readonly redis: Redis,
    @Optional() private readonly debounceMs: number = DEFAULT_DEBOUNCE_MS,
  ) {}

  @EventPattern(SHIPMENT_ORDER_STATUS_WILDCARD)
  onTrigger(@Ctx() context: NatsContext): void {
    const subject = context.getSubject();
    const shipmentOrderId = subject.split('.').pop();
    if (!shipmentOrderId) {
      return;
    }
    this.scheduleRecompute(shipmentOrderId);
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
