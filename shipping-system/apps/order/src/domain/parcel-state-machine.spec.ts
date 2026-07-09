import { BusinessRuleException } from '@app/dtos';
import { ParcelDirection, ParcelState } from '../entities/parcel.enums';
import { ParcelStateMachine, TrackingEventType } from './parcel-state-machine';

describe('ParcelStateMachine', () => {
  describe('happy-path transitions', () => {
    it.each([
      [ParcelState.CREATED, TrackingEventType.PICKUP, ParcelState.IN_TRANSIT],
      [
        ParcelState.IN_TRANSIT,
        TrackingEventType.HUB_RECEIVE,
        ParcelState.IN_HUB,
      ],
      [
        ParcelState.IN_HUB,
        TrackingEventType.DEPARTED_LINEHAUL,
        ParcelState.IN_TRANSIT,
      ],
      [
        ParcelState.IN_TRANSIT,
        TrackingEventType.ARRIVED_AT_HUB,
        ParcelState.IN_HUB,
      ],
      [
        ParcelState.IN_HUB,
        TrackingEventType.OUT_FOR_DELIVERY,
        ParcelState.OUT_FOR_DELIVERY,
      ],
      [
        ParcelState.OUT_FOR_DELIVERY,
        TrackingEventType.DELIVERED,
        ParcelState.DELIVERED,
      ],
      [
        ParcelState.OUT_FOR_DELIVERY,
        TrackingEventType.DELIVERY_FAILED,
        ParcelState.OUT_FOR_DELIVERY,
      ],
    ])(
      'transitions %s --%s--> %s',
      (from: ParcelState, event: TrackingEventType, to: ParcelState) => {
        expect(ParcelStateMachine.transition(from, event)).toBe(to);
      },
    );
  });

  describe('BR-02 guard: Out_for_Delivery only after destination hub arrival', () => {
    it.each([
      ParcelState.CREATED,
      ParcelState.IN_TRANSIT,
      ParcelState.OUT_FOR_DELIVERY,
      ParcelState.DELIVERED,
    ])('blocks OUT_FOR_DELIVERY from %s', (from: ParcelState) => {
      expect(() =>
        ParcelStateMachine.transition(from, TrackingEventType.OUT_FOR_DELIVERY),
      ).toThrow(BusinessRuleException);

      try {
        ParcelStateMachine.transition(from, TrackingEventType.OUT_FOR_DELIVERY);
        fail('expected BusinessRuleException');
      } catch (error) {
        expect((error as BusinessRuleException).rule).toBe('BR-02');
      }
    });
  });

  describe('undefined transitions', () => {
    it('throws a plain error for a transition outside the happy-path table (no BR covers it)', () => {
      expect(() =>
        ParcelStateMachine.transition(
          ParcelState.DELIVERED,
          TrackingEventType.PICKUP,
        ),
      ).toThrow(/No valid transition/);
    });
  });

  describe('BR-02 Misrouted: wrong-hub scan (transient state)', () => {
    it.each([ParcelState.IN_TRANSIT, ParcelState.IN_HUB])(
      'blocks the forward flow from %s and sets Misrouted',
      (from: ParcelState) => {
        expect(
          ParcelStateMachine.transition(from, TrackingEventType.MISROUTED),
        ).toBe(ParcelState.MISROUTED);
      },
    );

    it.each([TrackingEventType.HUB_RECEIVE, TrackingEventType.ARRIVED_AT_HUB])(
      'resumes the forward flow once corrected via %s',
      (event: TrackingEventType) => {
        expect(
          ParcelStateMachine.transition(ParcelState.MISROUTED, event),
        ).toBe(ParcelState.IN_HUB);
      },
    );
  });

  describe('markLostSuspected: passive SLA-timeout detection', () => {
    it.each([
      ParcelState.IN_TRANSIT,
      ParcelState.IN_HUB,
      ParcelState.OUT_FOR_DELIVERY,
      ParcelState.MISROUTED,
    ])('marks a parcel Lost from %s', (from: ParcelState) => {
      expect(ParcelStateMachine.markLostSuspected(from)).toBe(ParcelState.LOST);
    });

    it.each([
      ParcelState.CREATED,
      ParcelState.DELIVERED,
      ParcelState.LOST,
      ParcelState.DAMAGED,
    ])(
      'rejects marking Lost from %s (never dispatched or already terminal)',
      (from: ParcelState) => {
        expect(() => ParcelStateMachine.markLostSuspected(from)).toThrow();
      },
    );
  });

  describe('applyRts: BR-04, 3rd failed delivery attempt', () => {
    it('flips direction to Reverse_RTS and resets state to InTransit, heading back', () => {
      expect(ParcelStateMachine.applyRts(ParcelState.OUT_FOR_DELIVERY)).toEqual(
        {
          state: ParcelState.IN_TRANSIT,
          direction: ParcelDirection.REVERSE_RTS,
        },
      );
    });

    it('rejects applying RTS from any state other than Out_for_Delivery', () => {
      expect(() => ParcelStateMachine.applyRts(ParcelState.IN_HUB)).toThrow();
    });
  });

  describe('markDamaged: administrative action, no documented trigger event', () => {
    it.each([
      ParcelState.CREATED,
      ParcelState.IN_TRANSIT,
      ParcelState.IN_HUB,
      ParcelState.OUT_FOR_DELIVERY,
      ParcelState.MISROUTED,
    ])('marks a parcel Damaged from %s', (from: ParcelState) => {
      expect(ParcelStateMachine.markDamaged(from)).toBe(ParcelState.DAMAGED);
    });

    it.each([ParcelState.DELIVERED, ParcelState.LOST, ParcelState.DAMAGED])(
      'rejects marking Damaged from an already-terminal state %s',
      (from: ParcelState) => {
        expect(() => ParcelStateMachine.markDamaged(from)).toThrow();
      },
    );
  });

  describe('terminal states reject any further transition()', () => {
    it.each([ParcelState.DELIVERED, ParcelState.LOST, ParcelState.DAMAGED])(
      'rejects every event from %s',
      (from: ParcelState) => {
        expect(() =>
          ParcelStateMachine.transition(from, TrackingEventType.HUB_RECEIVE),
        ).toThrow();
      },
    );
  });
});
