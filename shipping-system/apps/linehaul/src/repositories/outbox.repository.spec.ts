import { OutboxRepository } from './outbox.repository';
import { OutboxStatus } from '../entities/outbox.entity';

describe('OutboxRepository', () => {
  let find: jest.Mock;
  let update: jest.Mock;
  let repository: OutboxRepository;

  beforeEach(() => {
    find = jest.fn();
    update = jest.fn().mockResolvedValue(undefined);
    repository = new OutboxRepository({ find, update } as never);
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
