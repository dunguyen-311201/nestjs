import { OutboxRepository } from './outbox.repository';
import { OutboxStatus } from '../entities/outbox.entity';

describe('OutboxRepository', () => {
  let find: jest.Mock;
  let update: jest.Mock;
  let save: jest.Mock;
  let repository: OutboxRepository;

  beforeEach(() => {
    find = jest.fn();
    update = jest.fn().mockResolvedValue(undefined);
    save = jest.fn().mockResolvedValue(undefined);
    repository = new OutboxRepository({ find, update, save } as never);
  });

  it('inserts a new outbox row', async () => {
    const event = {
      eventId: 'evt-1',
      eventType: 'parcel.out_for_delivery',
      payload: { parcel_id: 'parcel-1', courier_id: 'courier-1' },
    };

    await repository.insert(event);

    expect(save).toHaveBeenCalledWith(event);
  });

  it('finds a batch of PENDING rows ordered oldest first, limited', async () => {
    const rows = [{ id: 'ob-1', status: OutboxStatus.PENDING }];
    find.mockResolvedValue(rows);

    const result = await repository.findPendingBatch(10);

    expect(find).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { status: OutboxStatus.PENDING },
        order: { createdAt: 'ASC' },
        take: 10,
      }),
    );
    expect(result).toBe(rows);
  });

  it('marks a row PUBLISHED with a published_at timestamp', async () => {
    await repository.markPublished('ob-1');

    expect(update).toHaveBeenCalledWith(
      'ob-1',
      expect.objectContaining({ status: OutboxStatus.PUBLISHED }),
    );
    const [, patch] = update.mock.calls[0] as [string, { publishedAt: Date }];
    expect(patch.publishedAt).toBeInstanceOf(Date);
  });
});
