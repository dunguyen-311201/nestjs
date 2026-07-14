/* eslint-disable @typescript-eslint/unbound-method -- jest.fn() mocks flagged as false positives */
import { NotFoundException } from '@nestjs/common';
import { BusinessRuleException } from '@app/dtos';
import { NATS_SUBJECTS } from '@app/contracts';
import { CourierService } from './courier.service';
import { IOrderLookupPort } from './ports/order-lookup.port';
import { ICourierRepository } from './ports/courier-repository.port';
import { IEventPublisher } from './ports/event-publisher.port';
import { IIdempotencyStore } from './ports/idempotency-store.port';
import { DeliveryOutcome } from './dto/deliver.dto';

describe('CourierService', () => {
  let orderLookup: jest.Mocked<IOrderLookupPort>;
  let courierRepository: jest.Mocked<ICourierRepository>;
  let eventPublisher: jest.Mocked<IEventPublisher>;
  let idempotencyStore: jest.Mocked<IIdempotencyStore>;
  let service: CourierService;

  beforeEach(() => {
    orderLookup = { findParcelOrderContext: jest.fn() };
    courierRepository = {
      getLatestAttemptNumber: jest.fn(),
      recordDeliverySuccess: jest.fn(),
      recordDeliveryFailure: jest.fn(),
    };
    eventPublisher = { publish: jest.fn() };
    idempotencyStore = { get: jest.fn(), set: jest.fn() };
    idempotencyStore.get.mockResolvedValue(null);
    service = new CourierService(
      orderLookup,
      courierRepository,
      eventPublisher,
      idempotencyStore,
    );
  });

  describe('pickup', () => {
    it('throws 404 when the parcel does not exist', async () => {
      orderLookup.findParcelOrderContext.mockResolvedValue(null);

      await expect(
        service.pickup('parcel-1', { courier_id: 'courier-1' }, 'idem-1'),
      ).rejects.toThrow(NotFoundException);
      expect(eventPublisher.publish).not.toHaveBeenCalled();
    });

    it('throws 422 BR-08 when the parent order is not yet Confirmed+', async () => {
      orderLookup.findParcelOrderContext.mockResolvedValue({
        shipmentOrderId: 'order-1',
        orderStatus: 'Created',
        parcelDirection: 'Forward',
      });

      const error = await service
        .pickup('parcel-1', { courier_id: 'courier-1' }, 'idem-1')
        .catch((e: unknown) => e);

      expect(error).toBeInstanceOf(BusinessRuleException);
      expect((error as BusinessRuleException).rule).toBe('BR-08');
      expect(eventPublisher.publish).not.toHaveBeenCalled();
    });

    it('publishes parcel.picked_up when the order is Confirmed', async () => {
      orderLookup.findParcelOrderContext.mockResolvedValue({
        shipmentOrderId: 'order-1',
        orderStatus: 'Confirmed',
        parcelDirection: 'Forward',
      });

      const result = await service.pickup(
        'parcel-1',
        { courier_id: 'courier-1' },
        'idem-1',
      );

      expect(result.event).toBe('parcel.picked_up');
      expect(eventPublisher.publish).toHaveBeenCalledWith(
        NATS_SUBJECTS.PARCEL_PICKED_UP,
        expect.any(String),
        expect.objectContaining({
          parcel_id: 'parcel-1',
          courier_id: 'courier-1',
        }),
      );
      expect(idempotencyStore.set).toHaveBeenCalledWith(
        'idem:courier:idem-1',
        result,
        24 * 60 * 60,
      );
    });

    it('replays the cached response on a repeated Idempotency-Key', async () => {
      const cached = {
        event: 'parcel.picked_up',
        event_id: 'e1',
        published_at: 'x',
      };
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

    it('records PROOF_OF_DELIVERY and publishes parcel.delivered on success', async () => {
      orderLookup.findParcelOrderContext.mockResolvedValue({
        shipmentOrderId: 'order-1',
        orderStatus: 'Active',
        parcelDirection: 'Forward',
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

      expect(result).toMatchObject({
        event: 'parcel.delivered',
        proof_of_delivery_id: 'pod-1',
      });
      expect(eventPublisher.publish).toHaveBeenCalledWith(
        NATS_SUBJECTS.PARCEL_DELIVERED,
        expect.any(String),
        expect.objectContaining({
          parcel_id: 'parcel-1',
          courier_id: 'courier-1',
          signature_url: 'https://sig',
          photo_url: null,
        }),
      );
    });

    it('records a DELIVERY_ATTEMPT and publishes parcel.delivery_failed on the 1st/2nd failure', async () => {
      orderLookup.findParcelOrderContext.mockResolvedValue({
        shipmentOrderId: 'order-1',
        orderStatus: 'Active',
        parcelDirection: 'Forward',
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
        delivery_attempt_id: 'attempt-1',
        attempt_number: 1,
      });
      expect(eventPublisher.publish).toHaveBeenCalledWith(
        NATS_SUBJECTS.PARCEL_DELIVERY_FAILED,
        expect.any(String),
        expect.objectContaining({
          parcel_id: 'parcel-1',
          courier_id: 'courier-1',
          failure_reason: 'no answer',
        }),
      );
      expect(eventPublisher.publish).not.toHaveBeenCalledWith(
        NATS_SUBJECTS.PARCEL_RTS,
        expect.anything(),
        expect.anything(),
      );
    });

    it('publishes both parcel.delivery_failed and parcel.rts on the 3rd failure (BR-04)', async () => {
      orderLookup.findParcelOrderContext.mockResolvedValue({
        shipmentOrderId: 'order-1',
        orderStatus: 'Active',
        parcelDirection: 'Forward',
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

      expect(result).toMatchObject({
        delivery_attempt_id: 'attempt-3',
        attempt_number: 3,
        rts: { event: 'parcel.rts' },
      });
      expect(eventPublisher.publish).toHaveBeenCalledWith(
        NATS_SUBJECTS.PARCEL_RTS,
        expect.any(String),
        expect.objectContaining({ parcel_id: 'parcel-1' }),
      );
    });

    it('throws 422 BR-04 when a 4th attempt is submitted after RTS already triggered', async () => {
      orderLookup.findParcelOrderContext.mockResolvedValue({
        shipmentOrderId: 'order-1',
        orderStatus: 'Active',
        parcelDirection: 'Forward',
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
      const cached = { delivery_attempt_id: 'attempt-1', attempt_number: 1 };
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
});
