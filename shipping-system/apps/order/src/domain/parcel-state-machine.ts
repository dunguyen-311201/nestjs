import { BusinessRuleException } from '@app/dtos';
import { ParcelState } from '../entities/parcel.enums';

// Matches the `event_type` CHECK constraint on TRACKING_EVENT (db/init-db.sql).
export enum TrackingEventType {
  PICKUP = 'PICKUP',
  HUB_RECEIVE = 'HUB_RECEIVE',
  DEPARTED_LINEHAUL = 'DEPARTED_LINEHAUL',
  ARRIVED_AT_HUB = 'ARRIVED_AT_HUB',
  OUT_FOR_DELIVERY = 'OUT_FOR_DELIVERY',
  DELIVERY_FAILED = 'DELIVERY_FAILED',
  DELIVERED = 'DELIVERED',
  MISROUTED = 'MISROUTED',
  RTS = 'RTS',
}

type TransitionKey = `${ParcelState}:${TrackingEventType}`;

function key(state: ParcelState, event: TrackingEventType): TransitionKey {
  return `${state}:${event}`;
}

// Happy-path transitions only (docs/03-phases.md task 5.2). MISROUTED,
// DELIVERY_FAILED/RTS, and Lost/Damaged transitions are task 5.3's job -
// they need cross-service hub-identity data this pure module doesn't have.
const HAPPY_PATH_TRANSITIONS: Partial<Record<TransitionKey, ParcelState>> = {
  [key(ParcelState.CREATED, TrackingEventType.PICKUP)]: ParcelState.IN_TRANSIT,
  [key(ParcelState.IN_TRANSIT, TrackingEventType.HUB_RECEIVE)]:
    ParcelState.IN_HUB,
  [key(ParcelState.IN_HUB, TrackingEventType.DEPARTED_LINEHAUL)]:
    ParcelState.IN_TRANSIT,
  [key(ParcelState.IN_TRANSIT, TrackingEventType.ARRIVED_AT_HUB)]:
    ParcelState.IN_HUB,
  [key(ParcelState.IN_HUB, TrackingEventType.OUT_FOR_DELIVERY)]:
    ParcelState.OUT_FOR_DELIVERY,
  [key(ParcelState.OUT_FOR_DELIVERY, TrackingEventType.DELIVERED)]:
    ParcelState.DELIVERED,
};

export class ParcelStateMachine {
  static transition(
    currentState: ParcelState,
    event: TrackingEventType,
  ): ParcelState {
    const nextState = HAPPY_PATH_TRANSITIONS[key(currentState, event)];
    if (!nextState) {
      if (event === TrackingEventType.OUT_FOR_DELIVERY) {
        throw new BusinessRuleException(
          'BR-02',
          `Parcel must arrive at its destination hub before Out_for_Delivery (current state: ${currentState})`,
        );
      }
      // No documented BR-XX covers an arbitrary invalid transition outside
      // the Out_for_Delivery guard above - not a business-rule violation,
      // just an undefined FSM edge (e.g. an out-of-order/duplicate event).
      throw new Error(
        `No valid transition from ${currentState} on event ${event}`,
      );
    }
    return nextState;
  }
}
