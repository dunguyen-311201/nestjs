/* eslint-disable @typescript-eslint/unbound-method -- jest.fn() mocks flagged as false positives */
import { ForbiddenException, NotFoundException } from '@nestjs/common';
import { BusinessRuleException } from '@app/dtos';
import { CourierService } from './courier.service';
import { IOrderLookupPort } from './ports/order-lookup.port';
import { ICourierRepository } from './ports/courier-repository.port';
import { IIdempotencyStore } from './ports/idempotency-store.port';
import { DeliveryOutcome } from './dto/deliver.dto';

describe('CourierService', () => {
  let orderLookup: jest.Mocked<IOrderLookupPort>;
  let courierRepository: jest.Mocked<ICourierRepository>;
  let idempotencyStore: jest.Mocked<IIdempotencyStore>;
  let service: CourierService;

  beforeEach(() => {
    orderLookup = { findParcelOrderContext: jest.fn() };
    courierRepository = {
      getLatestAttemptNumber: jest.fn(),
      recordPickup: jest.fn(),
      recordDeliverySuccess: jest.fn(),
      recordDeliveryFailure: jest.fn(),
      findCourierIdByUserId: jest.fn(),
    };
    idempotencyStore = { get: jest.fn(), set: jest.fn() };
    idempotencyStore.get.mockResolvedValue(null);
    service = new CourierService(
      orderLookup,
      courierRepository,
      idempotencyStore,
    );
  });

  describe('pickup', () => {
    it('throws 404 when the parcel does not exist', async () => {
      orderLookup.findParcelOrderContext.mockResolvedValue(null);

      await expect(
        service.pickup('parcel-1', { courier_id: 'courier-1' }, 'idem-1'),
      ).rejects.toThrow(NotFoundException);
      expect(courierRepository.recordPickup).not.toHaveBeenCalled();
    });

    it('throws 422 BR-08 when the parent order is not yet Confirmed+', async () => {
      orderLookup.findParcelOrderContext.mockResolvedValue({
        shipmentOrderId: 'order-1',
        orderStatus: 'Created',
        parcelDirection: 'Forward',
        assignedCourierId: null,
      });

      const error = await service
        .pickup('parcel-1', { courier_id: 'courier-1' }, 'idem-1')
        .catch((e: unknown) => e);

      expect(error).toBeInstanceOf(BusinessRuleException);
      expect((error as BusinessRuleException).rule).toBe('BR-08');
      expect(courierRepository.recordPickup).not.toHaveBeenCalled();
    });

    it('writes an OUTBOX row for parcel.picked_up when the order is Confirmed', async () => {
      orderLookup.findParcelOrderContext.mockResolvedValue({
        shipmentOrderId: 'order-1',
        orderStatus: 'Confirmed',
        parcelDirection: 'Forward',
        assignedCourierId: null,
      });

      const result = await service.pickup(
        'parcel-1',
        { courier_id: 'courier-1' },
        'idem-1',
      );

      expect(result).toEqual({ status: 'recorded' });
      expect(courierRepository.recordPickup).toHaveBeenCalledWith(
        expect.objectContaining({
          eventId: expect.any(String) as string,
          eventType: 'parcel.picked_up',
          payload: expect.objectContaining({
            parcel_id: 'parcel-1',
            courier_id: 'courier-1',
          }) as unknown,
        }),
      );
      expect(idempotencyStore.set).toHaveBeenCalledWith(
        'idem:courier:idem-1',
        result,
        24 * 60 * 60,
      );
    });

    it('replays the cached response on a repeated Idempotency-Key', async () => {
      const cached = { status: 'recorded' };
      idempotencyStore.get.mockResolvedValue(cached);

      const result = await service.pickup(
        'parcel-1',
        { courier_id: 'courier-1' },
        'idem-1',
      );

      expect(result).toBe(cached);
      expect(orderLookup.findParcelOrderContext).not.toHaveBeenCalled();
    });
  });

  describe('deliver', () => {
    it('throws 404 when the parcel does not exist', async () => {
      orderLookup.findParcelOrderContext.mockResolvedValue(null);

      await expect(
        service.deliver(
          'parcel-1',
          {
            courier_id: 'courier-1',
            outcome: DeliveryOutcome.DELIVERED,
            signature_url: 's',
          },
          'idem-1',
        ),
      ).rejects.toThrow(NotFoundException);
    });

    it('records PROOF_OF_DELIVERY + an OUTBOX row on success', async () => {
      orderLookup.findParcelOrderContext.mockResolvedValue({
        shipmentOrderId: 'order-1',
        orderStatus: 'Active',
        parcelDirection: 'Forward',
        assignedCourierId: null,
      });
      courierRepository.recordDeliverySuccess.mockResolvedValue({
        proofOfDeliveryId: 'pod-1',
      });

      const result = await service.deliver(
        'parcel-1',
        {
          courier_id: 'courier-1',
          outcome: DeliveryOutcome.DELIVERED,
          signature_url: 'https://sig',
          photo_url: null,
        },
        'idem-1',
      );

      expect(result).toEqual({
        status: 'recorded',
        proof_of_delivery_id: 'pod-1',
      });
      expect(courierRepository.recordDeliverySuccess).toHaveBeenCalledWith(
        'parcel-1',
        'https://sig',
        null,
        expect.objectContaining({
          eventType: 'parcel.delivered',
          payload: expect.objectContaining({
            parcel_id: 'parcel-1',
            courier_id: 'courier-1',
            signature_url: 'https://sig',
            photo_url: null,
          }) as unknown,
        }),
      );
    });

    it('records a DELIVERY_ATTEMPT + OUTBOX row on the 1st/2nd failure, no rts flag', async () => {
      orderLookup.findParcelOrderContext.mockResolvedValue({
        shipmentOrderId: 'order-1',
        orderStatus: 'Active',
        parcelDirection: 'Forward',
        assignedCourierId: null,
      });
      courierRepository.getLatestAttemptNumber.mockResolvedValue(0);
      courierRepository.recordDeliveryFailure.mockResolvedValue({
        deliveryAttemptId: 'attempt-1',
        attemptNumber: 1,
        rtsTriggered: false,
      });

      const result = await service.deliver(
        'parcel-1',
        {
          courier_id: 'courier-1',
          outcome: DeliveryOutcome.FAILED,
          failure_reason: 'no answer',
        },
        'idem-1',
      );

      expect(result).toEqual({
        status: 'recorded',
        delivery_attempt_id: 'attempt-1',
        attempt_number: 1,
        rts_triggered: false,
      });
      const [, , , failedEvent, rtsEvent] =
        courierRepository.recordDeliveryFailure.mock.calls[0];
      expect(failedEvent).toMatchObject({
        eventType: 'parcel.delivery_failed',
        payload: expect.objectContaining({
          parcel_id: 'parcel-1',
          courier_id: 'courier-1',
          failure_reason: 'no answer',
        }) as unknown,
      });
      expect(rtsEvent).toMatchObject({
        eventType: 'parcel.rts',
        payload: expect.objectContaining({ parcel_id: 'parcel-1' }) as unknown,
      });
    });

    it('reports rts_triggered true on the 3rd failure (BR-04)', async () => {
      orderLookup.findParcelOrderContext.mockResolvedValue({
        shipmentOrderId: 'order-1',
        orderStatus: 'Active',
        parcelDirection: 'Forward',
        assignedCourierId: null,
      });
      courierRepository.getLatestAttemptNumber.mockResolvedValue(2);
      courierRepository.recordDeliveryFailure.mockResolvedValue({
        deliveryAttemptId: 'attempt-3',
        attemptNumber: 3,
        rtsTriggered: true,
      });

      const result = await service.deliver(
        'parcel-1',
        {
          courier_id: 'courier-1',
          outcome: DeliveryOutcome.FAILED,
          failure_reason: 'no answer',
        },
        'idem-1',
      );

      expect(result).toEqual({
        status: 'recorded',
        delivery_attempt_id: 'attempt-3',
        attempt_number: 3,
        rts_triggered: true,
      });
    });

    it('throws 422 BR-04 when a 4th attempt is submitted after RTS already triggered', async () => {
      orderLookup.findParcelOrderContext.mockResolvedValue({
        shipmentOrderId: 'order-1',
        orderStatus: 'Active',
        parcelDirection: 'Forward',
        assignedCourierId: null,
      });
      courierRepository.getLatestAttemptNumber.mockResolvedValue(3);

      const error = await service
        .deliver(
          'parcel-1',
          {
            courier_id: 'courier-1',
            outcome: DeliveryOutcome.FAILED,
            failure_reason: 'no answer',
          },
          'idem-1',
        )
        .catch((e: unknown) => e);

      expect(error).toBeInstanceOf(BusinessRuleException);
      expect((error as BusinessRuleException).rule).toBe('BR-04');
      expect(courierRepository.recordDeliveryFailure).not.toHaveBeenCalled();
    });

    it('replays the cached response on a repeated Idempotency-Key', async () => {
      const cached = {
        status: 'recorded',
        delivery_attempt_id: 'attempt-1',
        attempt_number: 1,
        rts_triggered: false,
      };
      idempotencyStore.get.mockResolvedValue(cached);

      const result = await service.deliver(
        'parcel-1',
        {
          courier_id: 'courier-1',
          outcome: DeliveryOutcome.FAILED,
          failure_reason: 'no answer',
        },
        'idem-1',
      );

      expect(result).toBe(cached);
      expect(orderLookup.findParcelOrderContext).not.toHaveBeenCalled();
    });
  });

  describe('shipper ownership enforcement (task 10.2)', () => {
    const shipper = { userId: 'user_ship_1', role: 'shipper' };

    function givenContext(assignedCourierId: string | null) {
      orderLookup.findParcelOrderContext.mockResolvedValue({
        shipmentOrderId: 'order-1',
        orderStatus: 'Confirmed',
        parcelDirection: 'Forward',
        assignedCourierId,
      });
    }

    it('allows pickup when the shipper acts as their own courier', async () => {
      givenContext(null);
      courierRepository.findCourierIdByUserId.mockResolvedValue('courier-1');

      await service.pickup(
        'parcel-1',
        { courier_id: 'courier-1' },
        'idem-1',
        shipper,
      );

      expect(courierRepository.findCourierIdByUserId).toHaveBeenCalledWith(
        'user_ship_1',
      );
      expect(courierRepository.recordPickup).toHaveBeenCalled();
    });

    it('rejects pickup with 403 when courier_id belongs to someone else', async () => {
      givenContext(null);
      courierRepository.findCourierIdByUserId.mockResolvedValue('courier-1');

      await expect(
        service.pickup(
          'parcel-1',
          { courier_id: 'courier-2' },
          'idem-1',
          shipper,
        ),
      ).rejects.toThrow(ForbiddenException);
      expect(courierRepository.recordPickup).not.toHaveBeenCalled();
    });

    it('rejects with 403 when the shipper account is not linked to any courier', async () => {
      givenContext(null);
      courierRepository.findCourierIdByUserId.mockResolvedValue(null);

      await expect(
        service.pickup(
          'parcel-1',
          { courier_id: 'courier-1' },
          'idem-1',
          shipper,
        ),
      ).rejects.toThrow(ForbiddenException);
    });

    it('allows deliver when the parcel is assigned to the shipper', async () => {
      givenContext('courier-1');
      courierRepository.findCourierIdByUserId.mockResolvedValue('courier-1');
      courierRepository.recordDeliverySuccess.mockResolvedValue({
        proofOfDeliveryId: 'pod-1',
      });

      const result = await service.deliver(
        'parcel-1',
        { courier_id: 'courier-1', outcome: DeliveryOutcome.DELIVERED },
        'idem-1',
        shipper,
      );

      expect(result.status).toBe('recorded');
    });

    it('rejects deliver with 403 when the parcel is assigned to another courier', async () => {
      givenContext('courier-2');
      courierRepository.findCourierIdByUserId.mockResolvedValue('courier-1');

      await expect(
        service.deliver(
          'parcel-1',
          { courier_id: 'courier-1', outcome: DeliveryOutcome.DELIVERED },
          'idem-1',
          shipper,
        ),
      ).rejects.toThrow(ForbiddenException);
      expect(courierRepository.recordDeliverySuccess).not.toHaveBeenCalled();
    });

    it('rejects deliver with 403 when the parcel has no assignment yet', async () => {
      givenContext(null);
      courierRepository.findCourierIdByUserId.mockResolvedValue('courier-1');

      await expect(
        service.deliver(
          'parcel-1',
          { courier_id: 'courier-1', outcome: DeliveryOutcome.DELIVERED },
          'idem-1',
          shipper,
        ),
      ).rejects.toThrow(ForbiddenException);
    });

    it('does not enforce ownership for admin or missing role', async () => {
      givenContext('courier-9');
      courierRepository.recordDeliverySuccess.mockResolvedValue({
        proofOfDeliveryId: 'pod-1',
      });

      await service.deliver(
        'parcel-1',
        { courier_id: 'courier-1', outcome: DeliveryOutcome.DELIVERED },
        'idem-1',
        { userId: 'user_admin', role: 'admin' },
      );
      await service.pickup('parcel-1', { courier_id: 'courier-1' }, 'idem-2');

      expect(courierRepository.findCourierIdByUserId).not.toHaveBeenCalled();
    });
  });
});
