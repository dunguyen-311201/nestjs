import { CourierRepository } from './courier.repository';
import { DeliveryAttempt } from '../entities/delivery-attempt.entity';
import { DeliveryAttemptOutcome } from '../entities/delivery-attempt-outcome.enum';
import { ProofOfDelivery } from '../entities/proof-of-delivery.entity';
import { Outbox } from '../entities/outbox.entity';
import { Courier } from '../entities/courier.entity';

describe('CourierRepository', () => {
  let findMax: jest.Mock;
  let insertPod: jest.Mock;
  let insertAttempt: jest.Mock;
  let saveOutbox: jest.Mock;
  let dataSource: {
    getRepository: jest.Mock;
    transaction: jest.Mock;
    manager: { save: jest.Mock };
  };
  let repository: CourierRepository;

  const failedOutboxEvent = {
    eventId: 'evt-failed',
    eventType: 'parcel.delivery_failed',
    payload: { parcel_id: 'parcel-1' },
  };
  const rtsOutboxEvent = {
    eventId: 'evt-rts',
    eventType: 'parcel.rts',
    payload: { parcel_id: 'parcel-1' },
  };

  beforeEach(() => {
    findMax = jest.fn();
    insertPod = jest.fn();
    insertAttempt = jest.fn();
    saveOutbox = jest.fn().mockResolvedValue(undefined);
    dataSource = {
      getRepository: jest.fn().mockImplementation((entity: unknown) => {
        if (entity === DeliveryAttempt) {
          return {
            createQueryBuilder: () => ({
              select: () => ({
                where: () => ({
                  andWhere: () => ({
                    getRawOne: findMax,
                  }),
                }),
              }),
            }),
          };
        }
        throw new Error(`Unexpected repository target: ${String(entity)}`);
      }),
      transaction: jest.fn(),
      manager: { save: saveOutbox },
    };
    repository = new CourierRepository(dataSource as never);
  });

  describe('getLatestAttemptNumber', () => {
    it('returns 0 when no attempt has ever been recorded for this direction', async () => {
      findMax.mockResolvedValue({ max: null });

      const result = await repository.getLatestAttemptNumber(
        'parcel-1',
        'Forward',
      );

      expect(result).toBe(0);
    });

    it('returns the highest attempt_number recorded for this direction', async () => {
      findMax.mockResolvedValue({ max: '2' });

      const result = await repository.getLatestAttemptNumber(
        'parcel-1',
        'Forward',
      );

      expect(result).toBe(2);
    });
  });

  describe('findCourierIdByUserId', () => {
    let findOneCourier: jest.Mock;

    beforeEach(() => {
      findOneCourier = jest.fn();
      const originalImpl = dataSource.getRepository.getMockImplementation()!;
      dataSource.getRepository.mockImplementation((entity: unknown) =>
        entity === Courier
          ? { findOne: findOneCourier }
          : (originalImpl(entity) as unknown),
      );
    });

    it('returns the courier id linked to the Clerk user', async () => {
      findOneCourier.mockResolvedValue({ id: 'courier-1' });

      const result = await repository.findCourierIdByUserId('user_1');

      expect(findOneCourier).toHaveBeenCalledWith({
        where: { userId: 'user_1' },
      });
      expect(result).toBe('courier-1');
    });

    it('returns null when no courier is linked to the user', async () => {
      findOneCourier.mockResolvedValue(null);

      const result = await repository.findCourierIdByUserId('user_1');

      expect(result).toBeNull();
    });
  });

  describe('recordPickup', () => {
    it('saves only an OUTBOX row', async () => {
      await repository.recordPickup({
        eventId: 'evt-pickup',
        eventType: 'parcel.picked_up',
        payload: { parcel_id: 'parcel-1' },
      });

      expect(saveOutbox).toHaveBeenCalledWith(Outbox, {
        eventId: 'evt-pickup',
        eventType: 'parcel.picked_up',
        payload: { parcel_id: 'parcel-1' },
      });
    });
  });

  describe('recordDeliverySuccess', () => {
    it('inserts PROOF_OF_DELIVERY and saves the delivered-event OUTBOX row in one transaction', async () => {
      const managerSave = jest.fn().mockResolvedValue(undefined);
      dataSource.transaction.mockImplementation((cb: (m: unknown) => unknown) =>
        cb({
          getRepository: jest.fn().mockImplementation((entity: unknown) => {
            if (entity === ProofOfDelivery) {
              return { insert: insertPod };
            }
            throw new Error(`Unexpected: ${String(entity)}`);
          }),
          save: managerSave,
        }),
      );
      insertPod.mockResolvedValue({ identifiers: [{ id: 'pod-1' }] });

      const result = await repository.recordDeliverySuccess(
        'parcel-1',
        'https://sig',
        null,
        {
          eventId: 'evt-delivered',
          eventType: 'parcel.delivered',
          payload: { parcel_id: 'parcel-1' },
        },
      );

      expect(result).toEqual({ proofOfDeliveryId: 'pod-1' });
      expect(insertPod).toHaveBeenCalledWith({
        parcelId: 'parcel-1',
        signatureUrl: 'https://sig',
        photoUrl: null,
      });
      expect(managerSave).toHaveBeenCalledWith(Outbox, {
        eventId: 'evt-delivered',
        eventType: 'parcel.delivered',
        payload: { parcel_id: 'parcel-1' },
      });
    });
  });

  describe('recordDeliveryFailure', () => {
    function transactionManager(latestAttemptNumber: string | null) {
      const attemptFindOne = jest.fn();
      const attemptQb = {
        select: () => ({
          where: () => ({ andWhere: () => ({ getRawOne: attemptFindOne }) }),
        }),
      };
      attemptFindOne.mockResolvedValue({ max: latestAttemptNumber });
      const managerGetRepository = jest.fn().mockImplementation((entity) => {
        if (entity === DeliveryAttempt) {
          return { insert: insertAttempt, createQueryBuilder: () => attemptQb };
        }
        throw new Error(`Unexpected repository target: ${String(entity)}`);
      });
      const managerSave = jest.fn().mockResolvedValue(undefined);
      const managerQuery = jest.fn().mockResolvedValue(undefined);
      return {
        manager: {
          getRepository: managerGetRepository,
          save: managerSave,
          query: managerQuery,
        },
        managerSave,
        managerQuery,
      };
    }

    it('records attempt_number 1, saves only the failed-event OUTBOX row, and does not trigger RTS on the first failure', async () => {
      const { manager, managerSave } = transactionManager(null);
      dataSource.transaction.mockImplementation((cb: (m: unknown) => unknown) =>
        cb(manager),
      );
      insertAttempt.mockResolvedValue({ identifiers: [{ id: 'attempt-1' }] });

      const result = await repository.recordDeliveryFailure(
        'parcel-1',
        'Forward',
        'no answer',
        failedOutboxEvent,
        rtsOutboxEvent,
      );

      expect(result).toEqual({
        deliveryAttemptId: 'attempt-1',
        attemptNumber: 1,
        rtsTriggered: false,
      });
      expect(insertAttempt).toHaveBeenCalledWith({
        parcelId: 'parcel-1',
        direction: 'Forward',
        attemptNumber: 1,
        outcome: DeliveryAttemptOutcome.FAILED,
        failureReason: 'no answer',
      });
      expect(managerSave).toHaveBeenCalledTimes(1);
      expect(managerSave).toHaveBeenCalledWith(Outbox, failedOutboxEvent);
    });

    it('takes a per-(parcel, direction) advisory lock before computing the next attempt number, to serialize concurrent failures', async () => {
      const { manager, managerQuery } = transactionManager(null);
      dataSource.transaction.mockImplementation((cb: (m: unknown) => unknown) =>
        cb(manager),
      );
      insertAttempt.mockResolvedValue({ identifiers: [{ id: 'attempt-1' }] });

      await repository.recordDeliveryFailure(
        'parcel-1',
        'Forward',
        'no answer',
        failedOutboxEvent,
        rtsOutboxEvent,
      );

      expect(managerQuery).toHaveBeenCalledWith(
        'SELECT pg_advisory_xact_lock(hashtext($1))',
        ['parcel-1:Forward'],
      );
      const lockCallOrder = managerQuery.mock.invocationCallOrder[0];
      const insertCallOrder = insertAttempt.mock.invocationCallOrder[0];
      expect(lockCallOrder).toBeLessThan(insertCallOrder);
    });

    it('saves both the failed-event and rts-event OUTBOX rows on the 3rd consecutive failure', async () => {
      const { manager, managerSave } = transactionManager('2');
      dataSource.transaction.mockImplementation((cb: (m: unknown) => unknown) =>
        cb(manager),
      );
      insertAttempt.mockResolvedValue({ identifiers: [{ id: 'attempt-3' }] });

      const result = await repository.recordDeliveryFailure(
        'parcel-1',
        'Forward',
        'no answer',
        failedOutboxEvent,
        rtsOutboxEvent,
      );

      expect(result).toEqual({
        deliveryAttemptId: 'attempt-3',
        attemptNumber: 3,
        rtsTriggered: true,
      });
      expect(managerSave).toHaveBeenCalledTimes(2);
      expect(managerSave).toHaveBeenCalledWith(Outbox, failedOutboxEvent);
      expect(managerSave).toHaveBeenCalledWith(Outbox, rtsOutboxEvent);
    });

    it('scopes numbering to the reverse leg independently of the forward leg', async () => {
      const { manager } = transactionManager(null);
      dataSource.transaction.mockImplementation((cb: (m: unknown) => unknown) =>
        cb(manager),
      );
      insertAttempt.mockResolvedValue({
        identifiers: [{ id: 'reverse-attempt-1' }],
      });

      const result = await repository.recordDeliveryFailure(
        'parcel-1',
        'Reverse_RTS',
        'no answer',
        failedOutboxEvent,
        rtsOutboxEvent,
      );

      expect(result.attemptNumber).toBe(1);
      expect(insertAttempt).toHaveBeenCalledWith(
        expect.objectContaining({ direction: 'Reverse_RTS', attemptNumber: 1 }),
      );
    });
  });
});
