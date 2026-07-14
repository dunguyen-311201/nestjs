import { CourierRepository } from './courier.repository';
import { DeliveryAttempt } from '../entities/delivery-attempt.entity';
import { DeliveryAttemptOutcome } from '../entities/delivery-attempt-outcome.enum';
import { ProofOfDelivery } from '../entities/proof-of-delivery.entity';

describe('CourierRepository', () => {
  let findMax: jest.Mock;
  let insertPod: jest.Mock;
  let insertAttempt: jest.Mock;
  let dataSource: {
    getRepository: jest.Mock;
    transaction: jest.Mock;
  };
  let repository: CourierRepository;

  beforeEach(() => {
    findMax = jest.fn();
    insertPod = jest.fn();
    insertAttempt = jest.fn();
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

  describe('recordDeliverySuccess', () => {
    it('inserts a PROOF_OF_DELIVERY row and returns its id', async () => {
      dataSource.transaction.mockImplementation((cb: (m: unknown) => unknown) =>
        cb({
          getRepository: jest.fn().mockImplementation((entity: unknown) => {
            if (entity === ProofOfDelivery) {
              return { insert: insertPod };
            }
            throw new Error(`Unexpected: ${String(entity)}`);
          }),
        }),
      );
      insertPod.mockResolvedValue({ identifiers: [{ id: 'pod-1' }] });

      const result = await repository.recordDeliverySuccess(
        'parcel-1',
        'https://sig',
        null,
      );

      expect(result).toEqual({ proofOfDeliveryId: 'pod-1' });
      expect(insertPod).toHaveBeenCalledWith({
        parcelId: 'parcel-1',
        signatureUrl: 'https://sig',
        photoUrl: null,
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
      return { manager: { getRepository: managerGetRepository } };
    }

    it('records attempt_number 1 and does not trigger RTS on the first failure', async () => {
      const { manager } = transactionManager(null);
      dataSource.transaction.mockImplementation((cb: (m: unknown) => unknown) =>
        cb(manager),
      );
      insertAttempt.mockResolvedValue({ identifiers: [{ id: 'attempt-1' }] });

      const result = await repository.recordDeliveryFailure(
        'parcel-1',
        'Forward',
        'no answer',
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
    });

    it('triggers RTS on the 3rd consecutive failure', async () => {
      const { manager } = transactionManager('2');
      dataSource.transaction.mockImplementation((cb: (m: unknown) => unknown) =>
        cb(manager),
      );
      insertAttempt.mockResolvedValue({ identifiers: [{ id: 'attempt-3' }] });

      const result = await repository.recordDeliveryFailure(
        'parcel-1',
        'Forward',
        'no answer',
      );

      expect(result).toEqual({
        deliveryAttemptId: 'attempt-3',
        attemptNumber: 3,
        rtsTriggered: true,
      });
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
      );

      expect(result.attemptNumber).toBe(1);
      expect(insertAttempt).toHaveBeenCalledWith(
        expect.objectContaining({ direction: 'Reverse_RTS', attemptNumber: 1 }),
      );
    });
  });
});
