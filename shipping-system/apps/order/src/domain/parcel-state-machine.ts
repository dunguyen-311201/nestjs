import { BusinessRuleException } from '@app/dtos';
import { ParcelDirection, ParcelState } from '../entities/parcel.enums';

// Matches the `event_type` CHECK constraint on the TRACKING_EVENT table
// (see db/init-db.sql).
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

// Forward happy-path transitions, plus Misrouted as a transient detour off
// that path: a wrong-hub scan blocks the forward flow and parks the parcel
// in Misrouted; once corrected, the same hub-arrival events used by the
// forward flow (HUB_RECEIVE/ARRIVED_AT_HUB) resume it from Misrouted back
// into InHub. RTS and Lost/Damaged are handled by the separate methods
// below - they aren't scan-event-driven the same way. DELIVERY_FAILED is
// a self-transition (state doesn't change until the 3rd failure triggers
// applyRts) so that an event-replay/projection consumer can fold over
// every TRACKING_EVENT row, including DELIVERY_FAILED ones, without
// having to filter them out first.
const TRANSITIONS: Partial<Record<TransitionKey, ParcelState>> = {
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
  [key(ParcelState.OUT_FOR_DELIVERY, TrackingEventType.DELIVERY_FAILED)]:
    ParcelState.OUT_FOR_DELIVERY,
  [key(ParcelState.IN_TRANSIT, TrackingEventType.MISROUTED)]:
    ParcelState.MISROUTED,
  [key(ParcelState.IN_HUB, TrackingEventType.MISROUTED)]: ParcelState.MISROUTED,
  [key(ParcelState.MISROUTED, TrackingEventType.HUB_RECEIVE)]:
    ParcelState.IN_HUB,
  [key(ParcelState.MISROUTED, TrackingEventType.ARRIVED_AT_HUB)]:
    ParcelState.IN_HUB,
};

const TERMINAL_STATES: ReadonlySet<ParcelState> = new Set([
  ParcelState.DELIVERED,
  ParcelState.LOST,
  ParcelState.DAMAGED,
]);

// States a parcel can be marked Lost/Damaged from: anywhere it's actively
// moving through the network. Excludes CREATED (never dispatched, nothing
// to lose in transit) and the terminal states themselves.
const ACTIVE_STATES: ReadonlySet<ParcelState> = new Set([
  ParcelState.IN_TRANSIT,
  ParcelState.IN_HUB,
  ParcelState.OUT_FOR_DELIVERY,
  ParcelState.MISROUTED,
]);

export interface RtsResult {
  state: ParcelState;
  direction: ParcelDirection;
}

export class ParcelStateMachine {
  static transition(
    currentState: ParcelState,
    event: TrackingEventType,
  ): ParcelState {
    const nextState = TRANSITIONS[key(currentState, event)];
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

  // Triggered by Tracking's passive SLA-timeout sweep (no scan seen past
  // the SLA threshold), not by a real scan event - hence a dedicated method
  // instead of a TrackingEventType entry.
  static markLostSuspected(currentState: ParcelState): ParcelState {
    if (!ACTIVE_STATES.has(currentState)) {
      throw new Error(
        `Cannot mark Lost from ${currentState}: parcel was never dispatched or is already terminal`,
      );
    }
    return ParcelState.LOST;
  }

  // Triggered by Courier Service after the 3rd consecutive DELIVERY_FAILED
  // scan for this parcel (BR-04). Courier already validated the 3-strike
  // count itself - this only re-asserts the parcel was actually out for
  // delivery, flips direction, and re-enters it into the forward flow
  // (InTransit) headed back toward the original sender's zone.
  static applyRts(currentState: ParcelState): RtsResult {
    if (currentState !== ParcelState.OUT_FOR_DELIVERY) {
      throw new Error(
        `Cannot apply RTS from ${currentState}: parcel was not Out_for_Delivery`,
      );
    }
    return {
      state: ParcelState.IN_TRANSIT,
      direction: ParcelDirection.REVERSE_RTS,
    };
  }

  // Administrative action with no scan-event or BR backing it in this
  // scoped slice (no `DAMAGED` value in TRACKING_EVENT.event_type, no
  // business rule describes how this fires) - allowed from any
  // non-terminal state.
  static markDamaged(currentState: ParcelState): ParcelState {
    if (TERMINAL_STATES.has(currentState)) {
      throw new Error(
        `Cannot mark Damaged from ${currentState}: parcel is already in a terminal state`,
      );
    }
    return ParcelState.DAMAGED;
  }
}
