import { CourierController } from './courier.controller';
import { CourierService } from './courier.service';
import { DeliveryOutcome } from './dto/deliver.dto';

describe('CourierController', () => {
  let courierService: jest.Mocked<Pick<CourierService, 'pickup' | 'deliver'>>;
  let controller: CourierController;

  beforeEach(() => {
    courierService = { pickup: jest.fn(), deliver: jest.fn() };
    controller = new CourierController(
      courierService as unknown as CourierService,
    );
  });

  it('delegates pickup to CourierService with the parcel id, dto, idempotency key, and caller', async () => {
    const expected = {
      event: 'parcel.picked_up',
      event_id: 'e1',
      published_at: 'x',
    };
    courierService.pickup.mockResolvedValue(expected as never);

    const result = await controller.pickup(
      'parcel-1',
      { courier_id: 'courier-1' },
      'idem-1',
      'user_1',
      'shipper',
    );

    expect(result).toBe(expected);
    expect(courierService.pickup).toHaveBeenCalledWith(
      'parcel-1',
      { courier_id: 'courier-1' },
      'idem-1',
      { userId: 'user_1', role: 'shipper' },
    );
  });

  it('delegates deliver to CourierService with the parcel id, dto, idempotency key, and caller', async () => {
    const expected = { delivery_attempt_id: 'attempt-1', attempt_number: 1 };
    courierService.deliver.mockResolvedValue(expected);
    const dto = {
      courier_id: 'courier-1',
      outcome: DeliveryOutcome.FAILED,
      failure_reason: 'no answer',
    };

    const result = await controller.deliver(
      'parcel-1',
      dto,
      'idem-1',
      'user_1',
      'shipper',
    );

    expect(result).toBe(expected);
    expect(courierService.deliver).toHaveBeenCalledWith(
      'parcel-1',
      dto,
      'idem-1',
      { userId: 'user_1', role: 'shipper' },
    );
  });

  it('passes null caller fields when the identity headers are absent', async () => {
    courierService.pickup.mockResolvedValue({ status: 'recorded' } as never);

    await controller.pickup(
      'parcel-1',
      { courier_id: 'courier-1' },
      'idem-1',
      undefined,
      undefined,
    );

    expect(courierService.pickup).toHaveBeenCalledWith(
      'parcel-1',
      { courier_id: 'courier-1' },
      'idem-1',
      { userId: null, role: null },
    );
  });
});
