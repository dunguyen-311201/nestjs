import { HubRepository } from './hub.repository';
import { Hub } from '../entities/hub.entity';
import { Route } from '../entities/route.entity';
import { Outbox } from '../entities/outbox.entity';

describe('HubRepository', () => {
  let findOneHub: jest.Mock;
  let findOneRoute: jest.Mock;
  let transaction: jest.Mock;
  let dataSource: {
    getRepository: jest.Mock;
    transaction: jest.Mock;
  };
  let repository: HubRepository;

  beforeEach(() => {
    findOneHub = jest.fn();
    findOneRoute = jest.fn();
    transaction = jest.fn();
    dataSource = {
      getRepository: jest.fn().mockImplementation((entity: unknown) => {
        if (entity === Hub) {
          return { findOne: findOneHub };
        }
        if (entity === Route) {
          return { findOne: findOneRoute };
        }
        throw new Error(`Unexpected repository target: ${String(entity)}`);
      }),
      transaction,
    };
    repository = new HubRepository(dataSource as never);
  });

  describe('findHubById', () => {
    it('returns null when the hub does not exist', async () => {
      findOneHub.mockResolvedValue(null);

      const result = await repository.findHubById('hub-1');

      expect(result).toBeNull();
    });

    it('returns the hub id + zoneId', async () => {
      findOneHub.mockResolvedValue({ id: 'hub-1', zoneId: 'zone-1' });

      const result = await repository.findHubById('hub-1');

      expect(result).toEqual({ id: 'hub-1', zoneId: 'zone-1' });
    });
  });

  describe('findRouteById', () => {
    it('returns null when the route does not exist', async () => {
      findOneRoute.mockResolvedValue(null);

      const result = await repository.findRouteById('route-1');

      expect(result).toBeNull();
    });

    it('returns the route', async () => {
      findOneRoute.mockResolvedValue({
        id: 'route-1',
        originZoneId: 'zone-1',
        destZoneId: 'zone-2',
      });

      const result = await repository.findRouteById('route-1');

      expect(result).toEqual({
        id: 'route-1',
        originZoneId: 'zone-1',
        destZoneId: 'zone-2',
      });
    });
  });

  describe('findRouteByZones', () => {
    it('queries by (origin_zone_id, dest_zone_id)', async () => {
      findOneRoute.mockResolvedValue({
        id: 'route-2',
        originZoneId: 'zone-2',
        destZoneId: 'zone-3',
      });

      const result = await repository.findRouteByZones('zone-2', 'zone-3');

      expect(findOneRoute).toHaveBeenCalledWith({
        where: { originZoneId: 'zone-2', destZoneId: 'zone-3' },
      });
      expect(result?.id).toBe('route-2');
    });
  });

  describe('recordScan', () => {
    it('saves a single OUTBOX row for a plain scan, in a transaction', async () => {
      const managerSave = jest.fn().mockResolvedValue(undefined);
      transaction.mockImplementation((cb: (m: unknown) => unknown) =>
        cb({ save: managerSave }),
      );

      await repository.recordScan([
        {
          eventId: 'evt-1',
          eventType: 'parcel.hub_received',
          payload: { parcel_id: 'parcel-1' },
        },
      ]);

      expect(transaction).toHaveBeenCalledTimes(1);
      expect(managerSave).toHaveBeenCalledTimes(1);
      expect(managerSave).toHaveBeenCalledWith(Outbox, {
        eventId: 'evt-1',
        eventType: 'parcel.hub_received',
        payload: { parcel_id: 'parcel-1' },
      });
    });

    it('saves both OUTBOX rows in the same transaction for a misrouted + corrective scan', async () => {
      const managerSave = jest.fn().mockResolvedValue(undefined);
      transaction.mockImplementation((cb: (m: unknown) => unknown) =>
        cb({ save: managerSave }),
      );

      await repository.recordScan([
        {
          eventId: 'evt-1',
          eventType: 'parcel.misrouted',
          payload: { parcel_id: 'parcel-1' },
        },
        {
          eventId: 'evt-2',
          eventType: 'parcel.hub_received',
          payload: { parcel_id: 'parcel-1', route_id: 'route-2' },
        },
      ]);

      expect(transaction).toHaveBeenCalledTimes(1);
      expect(managerSave).toHaveBeenCalledTimes(2);
    });
  });
});
