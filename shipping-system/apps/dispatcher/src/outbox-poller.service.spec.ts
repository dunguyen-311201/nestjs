import { OutboxPollerService } from './outbox-poller.service';
import { OutboxStatus } from './entities/outbox.entity';

describe('OutboxPollerService', () => {
  let outboxRepository: {
    findPendingBatch: jest.Mock;
    markPublished: jest.Mock;
  };
  let eventPublisher: { publish: jest.Mock };
  let service: OutboxPollerService;

  beforeEach(() => {
    outboxRepository = {
      findPendingBatch: jest.fn(),
      markPublished: jest.fn(),
    };
    eventPublisher = { publish: jest.fn().mockResolvedValue(undefined) };
    service = new OutboxPollerService(outboxRepository, eventPublisher);
  });

  it('publishes each pending row and marks it published', async () => {
    outboxRepository.findPendingBatch.mockResolvedValue([
      {
        id: 'ob-1',
        eventId: 'evt-1',
        eventType: 'parcel.out_for_delivery',
        payload: { parcel_id: 'parcel-1' },
        status: OutboxStatus.PENDING,
      },
    ]);

    await service.pollOnce();

    expect(eventPublisher.publish).toHaveBeenCalledWith(
      'parcel.out_for_delivery',
      'evt-1',
      { parcel_id: 'parcel-1' },
    );
    expect(outboxRepository.markPublished).toHaveBeenCalledWith('ob-1');
  });

  it('continues to the next row if one publish fails, without throwing', async () => {
    outboxRepository.findPendingBatch.mockResolvedValue([
      {
        id: 'ob-1',
        eventId: 'evt-1',
        eventType: 'parcel.out_for_delivery',
        payload: {},
      },
      {
        id: 'ob-2',
        eventId: 'evt-2',
        eventType: 'parcel.out_for_delivery',
        payload: {},
      },
    ]);
    eventPublisher.publish
      .mockRejectedValueOnce(new Error('NATS unreachable'))
      .mockResolvedValueOnce(undefined);

    await expect(service.pollOnce()).resolves.not.toThrow();

    expect(outboxRepository.markPublished).toHaveBeenCalledTimes(1);
    expect(outboxRepository.markPublished).toHaveBeenCalledWith('ob-2');
  });

  it('does not run a second batch concurrently while one is already in flight', async () => {
    let resolveFirst!: () => void;
    outboxRepository.findPendingBatch.mockImplementation(
      () =>
        new Promise((resolve) => {
          resolveFirst = () => resolve([]);
        }),
    );

    const firstCall = service.pollOnce();
    const secondCall = service.pollOnce();
    resolveFirst();
    await Promise.all([firstCall, secondCall]);

    expect(outboxRepository.findPendingBatch).toHaveBeenCalledTimes(1);
  });
});
