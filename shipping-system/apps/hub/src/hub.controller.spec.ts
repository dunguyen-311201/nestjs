import { HubController } from './hub.controller';
import { HubService } from './hub.service';

describe('HubController', () => {
  let hubService: jest.Mocked<Pick<HubService, 'receive'>>;
  let controller: HubController;

  beforeEach(() => {
    hubService = { receive: jest.fn() };
    controller = new HubController(hubService as unknown as HubService);
  });

  it('delegates to HubService with the hub id, dto, and idempotency key', async () => {
    const expected = { status: 'recorded' };
    hubService.receive.mockResolvedValue(expected as never);
    const dto = { parcel_id: 'parcel-1', actual_weight_grams: 500 };

    const result = await controller.receive('hub-1', dto, 'idem-1');

    expect(result).toBe(expected);
    expect(hubService.receive).toHaveBeenCalledWith('hub-1', dto, 'idem-1');
  });
});
