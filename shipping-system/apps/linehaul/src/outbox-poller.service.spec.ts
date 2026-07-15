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
        eventType: 'trip.departed',
        payload: { linehaul_trip_id: 't-1' },
        status: OutboxStatus.PENDING,
      },
    ]);

    await service.pollOnce();

    expect(eventPublisher.publish).toHaveBeenCalledWith(
      'trip.departed',
      'evt-1',
      { linehaul_trip_id: 't-1' },
    );
    expect(outboxRepository.markPublished).toHaveBeenCalledWith('ob-1');
  });

  it('continues to the next row if one publish fails, without throwing', async () => {
    outboxRepository.findPendingBatch.mockResolvedValue([
      { id: 'ob-1', eventId: 'evt-1', eventType: 'trip.departed', payload: {} },
      { id: 'ob-2', eventId: 'evt-2', eventType: 'trip.arrived', payload: {} },
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

  describe('circuit breaker', () => {
    const pendingRow = (id: string) => ({
      id,
      eventId: `evt-${id}`,
      eventType: 'parcel.hub_received',
      payload: {},
    });

    it('stops trying further rows in the same tick once the breaker opens', async () => {
      outboxRepository.findPendingBatch.mockResolvedValue([
        pendingRow('ob-1'),
        pendingRow('ob-2'),
        pendingRow('ob-3'),
        pendingRow('ob-4'),
        pendingRow('ob-5'),
        pendingRow('ob-6'),
      ]);
      eventPublisher.publish.mockRejectedValue(new Error('NATS unreachable'));

      await service.pollOnce();

      // 5 failures opens the breaker (default threshold) - the 6th row
      // must not even be attempted.
      expect(eventPublisher.publish).toHaveBeenCalledTimes(5);
      expect(outboxRepository.markPublished).not.toHaveBeenCalled();
    });

    it('skips the entire tick (no DB query, no publish) while the breaker is open', async () => {
      outboxRepository.findPendingBatch.mockResolvedValue([
        pendingRow('ob-1'),
        pendingRow('ob-2'),
        pendingRow('ob-3'),
        pendingRow('ob-4'),
        pendingRow('ob-5'),
      ]);
      eventPublisher.publish.mockRejectedValue(new Error('NATS unreachable'));
      await service.pollOnce(); // opens the breaker

      outboxRepository.findPendingBatch.mockClear();
      eventPublisher.publish.mockClear();
      await service.pollOnce(); // should be a no-op while OPEN

      expect(outboxRepository.findPendingBatch).not.toHaveBeenCalled();
      expect(eventPublisher.publish).not.toHaveBeenCalled();
    });

    it('resumes publishing once a later tick succeeds after the breaker recovers', async () => {
      outboxRepository.findPendingBatch.mockResolvedValue([
        pendingRow('ob-1'),
        pendingRow('ob-2'),
        pendingRow('ob-3'),
        pendingRow('ob-4'),
        pendingRow('ob-5'),
      ]);
      eventPublisher.publish.mockRejectedValue(new Error('NATS unreachable'));
      const realNow = Date.now;
      let now = 0;
      Date.now = () => now;
      try {
        await service.pollOnce(); // opens the breaker at t=0

        now += 5001; // past the initial 5s cooldown
        outboxRepository.findPendingBatch.mockResolvedValue([
          pendingRow('ob-6'),
        ]);
        eventPublisher.publish.mockResolvedValue(undefined);
        await service.pollOnce();

        expect(eventPublisher.publish).toHaveBeenCalledWith(
          'parcel.hub_received',
          'evt-ob-6',
          {},
        );
        expect(outboxRepository.markPublished).toHaveBeenCalledWith('ob-6');
      } finally {
        Date.now = realNow;
      }
    });
  });
});
