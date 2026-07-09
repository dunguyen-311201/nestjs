import { BusinessRuleException } from '@app/dtos';
import { ParcelState } from '../entities/parcel.enums';
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
});
