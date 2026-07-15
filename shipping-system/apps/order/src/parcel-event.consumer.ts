import { Controller, Logger } from '@nestjs/common';
import { EventPattern } from '@nestjs/microservices';
import { NATS_SUBJECTS } from '@app/contracts';
import { IOrderRepository } from './ports/order-repository.port';
import { ParcelStateMachine } from './domain/parcel-state-machine';
import { mapSubjectToEventType } from './domain/map-subject-to-event-type';

interface ParcelLifecyclePayload {
  parcel_id?: string;
  actual_weight_grams?: number;
  route_id?: string;
}

// Order independently consumes the same parcel-lifecycle events Tracking
// appends to TRACKING_EVENT (docs/02-HLD.md's subject table lists Order as
// a consumer of each), to keep its own PARCEL.state in sync via
// ParcelStateMachine (built in tasks 5.2/5.3, unwired until now).
@Controller()
export class ParcelEventConsumer {
  private readonly logger = new Logger(ParcelEventConsumer.name);

  constructor(private readonly orderRepository: IOrderRepository) {}

  @EventPattern(NATS_SUBJECTS.PARCEL_PICKED_UP)
  onPickedUp(payload: ParcelLifecyclePayload): Promise<void> {
    return this.handle(NATS_SUBJECTS.PARCEL_PICKED_UP, payload);
  }

  @EventPattern(NATS_SUBJECTS.PARCEL_HUB_RECEIVED)
  onHubReceived(payload: ParcelLifecyclePayload): Promise<void> {
    return this.handle(NATS_SUBJECTS.PARCEL_HUB_RECEIVED, payload);
  }

  @EventPattern(NATS_SUBJECTS.PARCEL_LOADED_FOR_LINEHAUL)
  onLoadedForLinehaul(payload: ParcelLifecyclePayload): Promise<void> {
    return this.handle(NATS_SUBJECTS.PARCEL_LOADED_FOR_LINEHAUL, payload);
  }

  @EventPattern(NATS_SUBJECTS.PARCEL_ARRIVED_AT_HUB)
  onArrivedAtHub(payload: ParcelLifecyclePayload): Promise<void> {
    return this.handle(NATS_SUBJECTS.PARCEL_ARRIVED_AT_HUB, payload);
  }

  @EventPattern(NATS_SUBJECTS.PARCEL_OUT_FOR_DELIVERY)
  onOutForDelivery(payload: ParcelLifecyclePayload): Promise<void> {
    return this.handle(NATS_SUBJECTS.PARCEL_OUT_FOR_DELIVERY, payload);
  }

  @EventPattern(NATS_SUBJECTS.PARCEL_DELIVERED)
  onDelivered(payload: ParcelLifecyclePayload): Promise<void> {
    return this.handle(NATS_SUBJECTS.PARCEL_DELIVERED, payload);
  }

  @EventPattern(NATS_SUBJECTS.PARCEL_MISROUTED)
  onMisrouted(payload: ParcelLifecyclePayload): Promise<void> {
    return this.handle(NATS_SUBJECTS.PARCEL_MISROUTED, payload);
  }

  @EventPattern(NATS_SUBJECTS.PARCEL_RTS)
  onRts(payload: ParcelLifecyclePayload): Promise<void> {
    return this.handle(NATS_SUBJECTS.PARCEL_RTS, payload);
  }

  @EventPattern(NATS_SUBJECTS.PARCEL_LOST_SUSPECTED)
  onLostSuspected(payload: ParcelLifecyclePayload): Promise<void> {
    return this.handle(NATS_SUBJECTS.PARCEL_LOST_SUSPECTED, payload);
  }

  private async handle(
    subject: string,
    payload: ParcelLifecyclePayload,
  ): Promise<void> {
    const eventType = mapSubjectToEventType(subject);
    if (
      (!eventType && subject !== NATS_SUBJECTS.PARCEL_LOST_SUSPECTED) ||
      !payload?.parcel_id
    ) {
      return;
    }

    const parcel = await this.orderRepository.findParcelById(payload.parcel_id);
    if (!parcel) {
      this.logger.warn(`Unknown parcel_id on ${subject}: ${payload.parcel_id}`);
      return;
    }

    // BR-06 (weight capture) and BR-02's corrective re-route both land on
    // this same subject - Hub Service never writes PARCEL directly (only
    // Order does), so it publishes the resolved values here instead.
    if (subject === NATS_SUBJECTS.PARCEL_HUB_RECEIVED) {
      const update: { actualWeightGrams?: number; routeId?: string } = {};
      if (typeof payload.actual_weight_grams === 'number') {
        update.actualWeightGrams = payload.actual_weight_grams;
      }
      if (payload.route_id) {
        update.routeId = payload.route_id;
      }
      if (Object.keys(update).length > 0) {
        await this.orderRepository.updateParcelWeightAndRoute(
          parcel.id,
          update,
        );
      }
    }

    try {
      if (subject === NATS_SUBJECTS.PARCEL_LOST_SUSPECTED) {
        const nextState = ParcelStateMachine.markLostSuspected(parcel.state);
        await this.orderRepository.updateParcelState(parcel.id, nextState);
      } else if (subject === NATS_SUBJECTS.PARCEL_RTS) {
        const rtsResult = ParcelStateMachine.applyRts(parcel.state);
        await this.orderRepository.updateParcelStateAndDirection(
          parcel.id,
          rtsResult.state,
          rtsResult.direction,
        );
      } else {
        const nextState = ParcelStateMachine.transition(
          parcel.state,
          eventType!,
        );
        await this.orderRepository.updateParcelState(parcel.id, nextState);
      }
    } catch (error) {
      // A NATS event consumer has no HTTP response to return a 422 on - a
      // BusinessRuleException (BR-02) or an undefined FSM edge here means
      // an out-of-order/duplicate/misrouted-adjacent event; log and drop
      // rather than crash the consumer.
      this.logger.warn(
        `Dropped ${subject} for parcel ${parcel.id}: ${(error as Error).message}`,
      );
    }
  }
}
