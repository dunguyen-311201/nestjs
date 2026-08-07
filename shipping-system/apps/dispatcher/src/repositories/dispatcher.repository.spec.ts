import { DispatcherRepository } from './dispatcher.repository';
import { Outbox } from '../entities/outbox.entity';

describe('DispatcherRepository', () => {
  describe('reserveCourierAssignment', () => {
    const parcelId = 'parcel-1';
    const outboxEvent = {
      eventId: 'evt-1',
      eventType: 'parcel.out_for_delivery',
      payload: { parcel_id: parcelId, courier_id: 'courier-1' },
    };

    function buildDataSource(options: {
      parcelState: string;
      existingOutboxRows?: Array<{ id: string }>;
    }) {
      const query = jest.fn().mockImplementation((sql: string) => {
        if (sql.includes('pg_advisory_xact_lock')) {
          return Promise.resolve(undefined);
        }
        if (sql.includes('shipping_order_db.parcel')) {
          return Promise.resolve([{ state: options.parcelState }]);
        }
        if (sql.includes('shipping_network_db.outbox')) {
          return Promise.resolve(options.existingOutboxRows ?? []);
        }
        throw new Error(`Unexpected query: ${sql}`);
      });
      const save = jest.fn().mockResolvedValue(undefined);
      const dataSource = {
        transaction: jest
          .fn()
          .mockImplementation((cb: (m: unknown) => unknown) =>
            cb({ query, save }),
          ),
      };
      return { dataSource, query, save };
    }

    it('takes a per-parcel advisory lock before reading the parcel state or the OUTBOX table', async () => {
      const { dataSource, query } = buildDataSource({ parcelState: 'InHub' });
      const repository = new DispatcherRepository(
        undefined as never,
        undefined as never,
        undefined as never,
        dataSource as never,
      );

      await repository.reserveCourierAssignment(parcelId, outboxEvent);

      expect(query).toHaveBeenCalledWith(
        'SELECT pg_advisory_xact_lock(hashtext($1))',
        [parcelId],
      );
      const lockOrder = query.mock.invocationCallOrder[0];
      const stateReadOrder = query.mock.invocationCallOrder[1];
      const outboxReadOrder = query.mock.invocationCallOrder[2];
      expect(lockOrder).toBeLessThan(stateReadOrder);
      expect(lockOrder).toBeLessThan(outboxReadOrder);
    });

    it('writes the OUTBOX row and returns "assigned" when the parcel is not terminal and has no prior assignment', async () => {
      const { dataSource, save } = buildDataSource({ parcelState: 'InHub' });
      const repository = new DispatcherRepository(
        undefined as never,
        undefined as never,
        undefined as never,
        dataSource as never,
      );

      const result = await repository.reserveCourierAssignment(
        parcelId,
        outboxEvent,
      );

      expect(result).toBe('assigned');
      expect(save).toHaveBeenCalledWith(Outbox, outboxEvent);
    });

    it.each(['Delivered', 'Lost', 'Damaged'])(
      'returns "parcel_terminal" and does not write OUTBOX when the parcel is already %s',
      async (parcelState) => {
        const { dataSource, save } = buildDataSource({ parcelState });
        const repository = new DispatcherRepository(
          undefined as never,
          undefined as never,
          undefined as never,
          dataSource as never,
        );

        const result = await repository.reserveCourierAssignment(
          parcelId,
          outboxEvent,
        );

        expect(result).toBe('parcel_terminal');
        expect(save).not.toHaveBeenCalled();
      },
    );

    it('returns "already_assigned" and does not write a second OUTBOX row when an assign-courier OUTBOX row already exists for this parcel (double-assign race)', async () => {
      const { dataSource, save } = buildDataSource({
        parcelState: 'InHub',
        existingOutboxRows: [{ id: 'ob-1' }],
      });
      const repository = new DispatcherRepository(
        undefined as never,
        undefined as never,
        undefined as never,
        dataSource as never,
      );

      const result = await repository.reserveCourierAssignment(
        parcelId,
        outboxEvent,
      );

      expect(result).toBe('already_assigned');
      expect(save).not.toHaveBeenCalled();
    });
  });
});
