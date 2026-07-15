import { DispatcherController } from './dispatcher.controller';
import { DispatcherService } from './dispatcher.service';

describe('DispatcherController', () => {
  let dispatcherService: jest.Mocked<
    Pick<DispatcherService, 'assignTrip' | 'assignLeg'>
  >;
  let controller: DispatcherController;

  beforeEach(() => {
    dispatcherService = {
      assignTrip: jest.fn(),
      assignLeg: jest.fn(),
    };
    controller = new DispatcherController(
      dispatcherService as unknown as DispatcherService,
    );
  });

  it('delegates assignTrip to DispatcherService with trip id + dto + idempotency key', async () => {
    const expected = { status: 'recorded' };
    dispatcherService.assignTrip.mockResolvedValue(expected as never);
    const dto = { driver_id: 'driver-1', truck_id: 'truck-1' };

    const result = await controller.assignTrip('trip-1', dto, 'idem-1');

    expect(result).toBe(expected);
    expect(dispatcherService.assignTrip).toHaveBeenCalledWith(
      'trip-1',
      dto,
      'idem-1',
    );
  });

  it('delegates assignLeg to DispatcherService with parcel id + dto + idempotency key', async () => {
    const expected = { status: 'recorded' };
    dispatcherService.assignLeg.mockResolvedValue(expected as never);
    const dto = { courier_id: 'courier-1' };

    const result = await controller.assignLeg('parcel-1', dto, 'idem-1');

    expect(result).toBe(expected);
    expect(dispatcherService.assignLeg).toHaveBeenCalledWith(
      'parcel-1',
      dto,
      'idem-1',
    );
  });
});
