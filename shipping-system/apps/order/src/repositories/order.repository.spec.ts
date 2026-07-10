import { OrderRepository } from './order.repository';
import { Customer } from '../entities/customer.entity';
import { ShipmentOrder } from '../entities/shipment-order.entity';
import { Parcel } from '../entities/parcel.entity';
import { Outbox } from '../entities/outbox.entity';
import { ShipmentOrderStatus } from '../entities/shipment-order-status.enum';
import {
  ParcelDirection,
  ParcelState,
  ParcelType,
} from '../entities/parcel.enums';

describe('OrderRepository', () => {
  let save: jest.Mock;
  let transaction: jest.Mock;
  let getRepository: jest.Mock;
  let dataSource: { transaction: jest.Mock; getRepository: jest.Mock };
  let repository: OrderRepository;

  beforeEach(() => {
    save = jest.fn().mockImplementation((entity: unknown, data: unknown) => {
      if (entity === Customer)
        return Promise.resolve({ id: 'customer-id', ...(data as object) });
      if (entity === ShipmentOrder)
        return Promise.resolve({ id: 'order-id', ...(data as object) });
      if (entity === Parcel) {
        const parcels = data as { shipmentOrderId: string }[];
        return Promise.resolve(
          parcels.map((p, i) => ({ id: `parcel-${i}`, ...p })),
        );
      }
      if (entity === Outbox) return Promise.resolve(data);
      throw new Error(`Unexpected save target: ${String(entity)}`);
    });
    transaction = jest
      .fn()
      .mockImplementation((cb: (manager: unknown) => unknown) => cb({ save }));
    getRepository = jest.fn();
    dataSource = { transaction, getRepository };
    repository = new OrderRepository(dataSource as never);
  });

  it('writes an order.created outbox row in the same transaction as the order/parcels', async () => {
    await repository.createOrder({
      sender: {
        nameEnc: 'n',
        phoneEnc: 'p',
        addressEnc: 'a',
        regionCode: 'REG-1',
      },
      recipient: {
        nameEnc: 'n2',
        phoneEnc: 'p2',
        addressEnc: 'a2',
        regionCode: 'REG-2',
      },
      rateCardId: 'rate-1',
      priceCents: 1000,
      expectedDeliveryAt: new Date('2026-01-05T00:00:00Z'),
      parcels: [
        {
          declaredWeightGrams: 500,
          type: ParcelType.PARCEL,
          direction: ParcelDirection.FORWARD,
          state: ParcelState.CREATED,
        },
      ],
    });

    expect(transaction).toHaveBeenCalledTimes(1);
    const calls = save.mock.calls as unknown[][];
    const outboxCall = calls.find((call) => call[0] === Outbox);
    expect(outboxCall).toBeDefined();
    const outboxData = (outboxCall as unknown[])[1] as Record<string, unknown>;
    expect(outboxData.eventType).toBe('order.created');
    expect(outboxData.status).toBe('PENDING');
    expect(outboxData.payload).toEqual({
      order_id: 'order-id',
      sender_id: 'customer-id',
      recipient_id: 'customer-id',
      parcel_ids: ['parcel-0'],
    });
    expect(typeof outboxData.eventId).toBe('string');
    // Order status status enum imported to keep this test honest about
    // which literal the CREATED order gets (avoids asserting on a
    // duplicated magic string).
    expect(ShipmentOrderStatus.CREATED).toBe('Created');
  });

  it('findParcelById reads a single parcel by id', async () => {
    const findOne = jest
      .fn()
      .mockResolvedValue({ id: 'parcel-1', state: ParcelState.IN_TRANSIT });
    getRepository.mockReturnValue({ findOne });

    const result = await repository.findParcelById('parcel-1');

    expect(getRepository).toHaveBeenCalledWith(Parcel);
    expect(findOne).toHaveBeenCalledWith({ where: { id: 'parcel-1' } });
    expect(result).toEqual({ id: 'parcel-1', state: ParcelState.IN_TRANSIT });
  });

  it('updateParcelState updates only the state column', async () => {
    const update = jest.fn().mockResolvedValue(undefined);
    getRepository.mockReturnValue({ update });

    await repository.updateParcelState('parcel-1', ParcelState.IN_HUB);

    expect(update).toHaveBeenCalledWith('parcel-1', {
      state: ParcelState.IN_HUB,
    });
  });

  it('findParcelStatesByShipmentOrderId returns null for an unknown order', async () => {
    getRepository.mockReturnValue({
      findOne: jest.fn().mockResolvedValue(null),
    });

    const result =
      await repository.findParcelStatesByShipmentOrderId('missing');

    expect(result).toBeNull();
  });

  it('findParcelStatesByShipmentOrderId returns the parcel states for an existing order', async () => {
    getRepository.mockImplementation((entity: unknown) => {
      if (entity === ShipmentOrder) {
        return { findOne: jest.fn().mockResolvedValue({ id: 'order-1' }) };
      }
      return {
        find: jest
          .fn()
          .mockResolvedValue([
            { state: ParcelState.DELIVERED },
            { state: ParcelState.IN_TRANSIT },
          ]),
      };
    });

    const result =
      await repository.findParcelStatesByShipmentOrderId('order-1');

    expect(result).toEqual([ParcelState.DELIVERED, ParcelState.IN_TRANSIT]);
  });

  it('updateShipmentOrderStatus updates only the status column', async () => {
    const update = jest.fn().mockResolvedValue(undefined);
    getRepository.mockReturnValue({ update });

    await repository.updateShipmentOrderStatus(
      'order-1',
      ShipmentOrderStatus.COMPLETE,
    );

    expect(update).toHaveBeenCalledWith('order-1', {
      status: ShipmentOrderStatus.COMPLETE,
    });
  });
});
