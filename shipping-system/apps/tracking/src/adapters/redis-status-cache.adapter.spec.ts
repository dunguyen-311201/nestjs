import { RedisStatusCacheAdapter } from './redis-status-cache.adapter';

describe('RedisStatusCacheAdapter', () => {
  let get: jest.Mock;
  let adapter: RedisStatusCacheAdapter;

  beforeEach(() => {
    get = jest.fn();
    adapter = new RedisStatusCacheAdapter({ get } as never);
  });

  it('reads the order:status:{id} key', async () => {
    get.mockResolvedValue('Complete');

    const result = await adapter.getStatus('order-1');

    expect(get).toHaveBeenCalledWith('order:status:order-1');
    expect(result).toBe('Complete');
  });

  it('returns null on a cache miss', async () => {
    get.mockResolvedValue(null);

    const result = await adapter.getStatus('order-1');

    expect(result).toBeNull();
  });
});
