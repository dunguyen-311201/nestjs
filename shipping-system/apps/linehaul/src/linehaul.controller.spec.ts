import { LinehaulController } from './linehaul.controller';
import { LinehaulService } from './linehaul.service';

describe('LinehaulController', () => {
  let linehaulService: jest.Mocked<
    Pick<LinehaulService, 'createTrip' | 'depart' | 'arrive'>
  >;
  let controller: LinehaulController;

  beforeEach(() => {
    linehaulService = {
      createTrip: jest.fn(),
      depart: jest.fn(),
      arrive: jest.fn(),
    };
    controller = new LinehaulController(
      linehaulService as unknown as LinehaulService,
    );
  });

  it('delegates create to LinehaulService with dto + idempotency key', async () => {
    const expected = { trip_id: 'trip-1' };
    linehaulService.createTrip.mockResolvedValue(expected);
    const dto = { origin_hub_id: 'hub-1', dest_hub_id: 'hub-2' };

    const result = await controller.create(dto, 'idem-1');

    expect(result).toBe(expected);
    expect(linehaulService.createTrip).toHaveBeenCalledWith(dto, 'idem-1');
  });

  it('delegates depart to LinehaulService with trip id + idempotency key', async () => {
    const expected = { status: 'recorded' };
    linehaulService.depart.mockResolvedValue(expected as never);

    const result = await controller.depart('trip-1', 'idem-1');

    expect(result).toBe(expected);
    expect(linehaulService.depart).toHaveBeenCalledWith('trip-1', 'idem-1');
  });

  it('delegates arrive to LinehaulService with trip id + idempotency key', async () => {
    const expected = { status: 'recorded' };
    linehaulService.arrive.mockResolvedValue(expected as never);

    const result = await controller.arrive('trip-1', 'idem-1');

    expect(result).toBe(expected);
    expect(linehaulService.arrive).toHaveBeenCalledWith('trip-1', 'idem-1');
  });
});
