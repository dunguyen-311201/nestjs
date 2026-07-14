import { LinehaulRepository } from './linehaul.repository';
import { LinehaulTrip } from '../entities/linehaul-trip.entity';
import { LinehaulTripStatus } from '../entities/linehaul-trip-status.enum';
import { Hub } from '../entities/hub.entity';
import { Outbox } from '../entities/outbox.entity';

describe('LinehaulRepository', () => {
  let findOneHub: jest.Mock;
  let findOneTrip: jest.Mock;
  let saveTrip: jest.Mock;
  let dataSource: {
    getRepository: jest.Mock;
    transaction: jest.Mock;
  };
  let repository: LinehaulRepository;

  beforeEach(() => {
    findOneHub = jest.fn();
    findOneTrip = jest.fn();
    saveTrip = jest.fn();
    dataSource = {
      getRepository: jest.fn().mockImplementation((entity: unknown) => {
        if (entity === Hub) {
          return { findOne: findOneHub };
        }
        if (entity === LinehaulTrip) {
          return { findOne: findOneTrip, save: saveTrip };
        }
        throw new Error(`Unexpected repository target: ${String(entity)}`);
      }),
      transaction: jest.fn(),
    };
    repository = new LinehaulRepository(dataSource as never);
  });

  describe('findHubById', () => {
    it('returns null when the hub does not exist', async () => {
      findOneHub.mockResolvedValue(null);

      const result = await repository.findHubById('hub-1');

      expect(result).toBeNull();
    });

    it('returns the hub when it exists', async () => {
      findOneHub.mockResolvedValue({ id: 'hub-1' });

      const result = await repository.findHubById('hub-1');

      expect(result).toEqual({ id: 'hub-1' });
    });
  });

  describe('createTrip', () => {
    it('inserts a Created-status trip', async () => {
      saveTrip.mockResolvedValue({
        id: 'trip-1',
        originHubId: 'hub-1',
        destHubId: 'hub-2',
        status: LinehaulTripStatus.CREATED,
      });

      const result = await repository.createTrip('hub-1', 'hub-2');

      expect(saveTrip).toHaveBeenCalledWith({
        originHubId: 'hub-1',
        destHubId: 'hub-2',
      });
      expect(result).toEqual({ id: 'trip-1' });
    });
  });

  describe('findTripById', () => {
    it('returns null when the trip does not exist', async () => {
      findOneTrip.mockResolvedValue(null);

      const result = await repository.findTripById('trip-1');

      expect(result).toBeNull();
    });

    it('returns the trip id + status', async () => {
      findOneTrip.mockResolvedValue({
        id: 'trip-1',
        status: LinehaulTripStatus.CREATED,
      });

      const result = await repository.findTripById('trip-1');

      expect(result).toEqual({
        id: 'trip-1',
        status: LinehaulTripStatus.CREATED,
      });
    });
  });

  describe('markDeparted', () => {
    it('updates status to Departed and saves the OUTBOX row in one transaction', async () => {
      const managerUpdate = jest.fn().mockResolvedValue(undefined);
      const managerSave = jest.fn().mockResolvedValue(undefined);
      dataSource.transaction.mockImplementation((cb: (m: unknown) => unknown) =>
        cb({
          update: managerUpdate,
          save: managerSave,
        }),
      );

      await repository.markDeparted('trip-1', {
        eventId: 'evt-1',
        eventType: 'trip.departed',
        payload: { linehaul_trip_id: 'trip-1' },
      });

      expect(managerUpdate).toHaveBeenCalledWith(LinehaulTrip, 'trip-1', {
        status: LinehaulTripStatus.DEPARTED,
      });
      expect(managerSave).toHaveBeenCalledWith(Outbox, {
        eventId: 'evt-1',
        eventType: 'trip.departed',
        payload: { linehaul_trip_id: 'trip-1' },
      });
    });
  });

  describe('markArrived', () => {
    it('updates status to Arrived and saves the OUTBOX row in one transaction', async () => {
      const managerUpdate = jest.fn().mockResolvedValue(undefined);
      const managerSave = jest.fn().mockResolvedValue(undefined);
      dataSource.transaction.mockImplementation((cb: (m: unknown) => unknown) =>
        cb({
          update: managerUpdate,
          save: managerSave,
        }),
      );

      await repository.markArrived('trip-1', {
        eventId: 'evt-2',
        eventType: 'trip.arrived',
        payload: { linehaul_trip_id: 'trip-1' },
      });

      expect(managerUpdate).toHaveBeenCalledWith(LinehaulTrip, 'trip-1', {
        status: LinehaulTripStatus.ARRIVED,
      });
      expect(managerSave).toHaveBeenCalledWith(Outbox, {
        eventId: 'evt-2',
        eventType: 'trip.arrived',
        payload: { linehaul_trip_id: 'trip-1' },
      });
    });
  });
});
