import { TrackingEventRepository } from './tracking-event.repository';
import { TrackingEventType } from '../entities/tracking-event.entity';

describe('TrackingEventRepository', () => {
  let insert: jest.Mock;
  let values: jest.Mock;
  let orIgnore: jest.Mock;
  let execute: jest.Mock;
  let createQueryBuilder: jest.Mock;
  let find: jest.Mock;
  let repository: TrackingEventRepository;

  beforeEach(() => {
    execute = jest.fn().mockResolvedValue(undefined);
    orIgnore = jest.fn().mockReturnValue({ execute });
    values = jest.fn().mockReturnValue({ orIgnore });
    insert = jest.fn().mockReturnValue({ values });
    createQueryBuilder = jest.fn().mockReturnValue({ insert });
    find = jest.fn();
    repository = new TrackingEventRepository({
      createQueryBuilder,
      find,
    } as never);
  });

  it('appends a new event via an idempotent insert (ON CONFLICT DO NOTHING on event_id)', async () => {
    await repository.appendEvent({
      eventId: 'event-1',
      parcelId: 'parcel-1',
      courierId: 'courier-1',
      eventType: TrackingEventType.PICKUP,
    });

    expect(createQueryBuilder).toHaveBeenCalled();
    expect(insert).toHaveBeenCalled();
    expect(values).toHaveBeenCalledWith(
      expect.objectContaining({
        eventId: 'event-1',
        parcelId: 'parcel-1',
        courierId: 'courier-1',
        eventType: TrackingEventType.PICKUP,
      }),
    );
    expect(orIgnore).toHaveBeenCalled();
    expect(execute).toHaveBeenCalled();
  });

  it('returns the timeline for the given parcel ids ordered oldest first', async () => {
    const rows = [
      { id: 'te-1', parcelId: 'parcel-1', eventType: TrackingEventType.PICKUP },
      {
        id: 'te-2',
        parcelId: 'parcel-1',
        eventType: TrackingEventType.HUB_RECEIVE,
      },
    ];
    find.mockResolvedValue(rows);

    const result = await repository.findTimelineByParcelIds(['parcel-1']);

    const callArgs = find.mock.calls[0][0] as {
      where: { parcelId: unknown };
      order: { createdAt: string };
    };
    expect(callArgs.where.parcelId).toBeDefined();
    expect(callArgs.order).toEqual({ createdAt: 'ASC' });
    expect(result).toBe(rows);
  });
});
