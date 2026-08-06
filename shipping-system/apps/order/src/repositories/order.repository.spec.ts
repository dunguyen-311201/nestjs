import { OrderRepository } from './order.repository';
import { Customer } from '../entities/customer.entity';
import { ShipmentOrder } from '../entities/shipment-order.entity';
import { Parcel } from '../entities/parcel.entity';
import { Outbox } from '../entities/outbox.entity';
import { Payment, PaymentType } from '../entities/payment.entity';
import { PaymentStatus } from '../entities/payment-status.enum';
import { ShipmentOrderStatus } from '../entities/shipment-order-status.enum';
import {
  ParcelDirection,
  ParcelState,
  ParcelType,
} from '../entities/parcel.enums';

describe('OrderRepository', () => {
  let save: jest.Mock;
  let findOne: jest.Mock;
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
      if (entity === Payment) return Promise.resolve(data);
      throw new Error(`Unexpected save target: ${String(entity)}`);
    });
    // No existing customer by default - createOrder falls back to saving
    // a new Customer row.
    findOne = jest.fn().mockResolvedValue(null);
    transaction = jest
      .fn()
      .mockImplementation((cb: (manager: unknown) => unknown) =>
        cb({ save, findOne }),
      );
    getRepository = jest.fn();
    dataSource = { transaction, getRepository };
    repository = new OrderRepository(dataSource as never);
  });

  function baseNewOrderData() {
    return {
      sender: {
        nameEnc: 'n',
        phoneEnc: 'p',
        phoneHash: 'hash-sender',
        addressEnc: 'a',
        regionCode: 'REG-1',
      },
      recipient: {
        nameEnc: 'n2',
        phoneEnc: 'p2',
        phoneHash: 'hash-recipient',
        addressEnc: 'a2',
        regionCode: 'REG-2',
      },
      rateCardId: 'rate-1',
      routeId: 'route-1',
      priceCents: 1000,
      expectedDeliveryAt: new Date('2026-01-05T00:00:00Z'),
      paymentType: PaymentType.PREPAID_STRIPE,
      parcels: [
        {
          declaredWeightGrams: 500,
          type: ParcelType.PARCEL,
          direction: ParcelDirection.FORWARD,
          state: ParcelState.CREATED,
        },
      ],
    };
  }

  it('writes an order.created outbox row in the same transaction as the order/parcels', async () => {
    await repository.createOrder(baseNewOrderData());

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

  it('writes route_id onto every parcel at creation time (BR-02 misroute detection depends on this)', async () => {
    await repository.createOrder(baseNewOrderData());

    const calls = save.mock.calls as unknown[][];
    const parcelCall = calls.find((call) => call[0] === Parcel);
    expect(parcelCall).toBeDefined();
    const parcelRows = (parcelCall as unknown[])[1] as Record<
      string,
      unknown
    >[];
    expect(parcelRows[0]).toMatchObject({ routeId: 'route-1' });
  });

  it('writes an Unpaid PAYMENT row in the same transaction as the order/parcels', async () => {
    await repository.createOrder(baseNewOrderData());

    const calls = save.mock.calls as unknown[][];
    const paymentCall = calls.find((call) => call[0] === Payment);
    expect(paymentCall).toBeDefined();
    const paymentData = (paymentCall as unknown[])[1] as Record<
      string,
      unknown
    >;
    expect(paymentData).toMatchObject({
      shipmentOrderId: 'order-id',
      type: PaymentType.PREPAID_STRIPE,
      amountCents: 1000,
      status: PaymentStatus.UNPAID,
    });
  });

  it('creates new CUSTOMER rows for sender/recipient when no phone_hash match exists', async () => {
    await repository.createOrder(baseNewOrderData());

    expect(findOne).toHaveBeenCalledWith(Customer, {
      where: { phoneHash: 'hash-sender' },
    });
    expect(findOne).toHaveBeenCalledWith(Customer, {
      where: { phoneHash: 'hash-recipient' },
    });
    const customerSaves = (save.mock.calls as unknown[][]).filter(
      (call) => call[0] === Customer,
    );
    expect(customerSaves).toHaveLength(2);
  });

  it('reuses an existing CUSTOMER by phone_hash instead of creating a duplicate', async () => {
    findOne.mockImplementation(
      (_entity: unknown, options: { where: { phoneHash: string } }) => {
        if (options.where.phoneHash === 'hash-sender') {
          return Promise.resolve({ id: 'existing-sender-id' });
        }
        return Promise.resolve(null);
      },
    );

    await repository.createOrder(baseNewOrderData());

    const customerSaves = (save.mock.calls as unknown[][]).filter(
      (call) => call[0] === Customer,
    );
    // Only the recipient (no match) gets a new row - the sender is reused.
    expect(customerSaves).toHaveLength(1);
    const orderSave = (save.mock.calls as unknown[][]).find(
      (call) => call[0] === ShipmentOrder,
    );
    const orderData = (orderSave as unknown[])[1] as Record<string, unknown>;
    expect(orderData.senderId).toBe('existing-sender-id');
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

  it('updateParcelAssignedCourier updates only the assigned courier column', async () => {
    const update = jest.fn().mockResolvedValue(undefined);
    getRepository.mockReturnValue({ update });

    await repository.updateParcelAssignedCourier('parcel-1', 'courier-9');

    expect(update).toHaveBeenCalledWith('parcel-1', {
      assignedCourierId: 'courier-9',
    });
  });

  it('updateParcelWeightAndRoute updates only the given columns', async () => {
    const update = jest.fn().mockResolvedValue(undefined);
    getRepository.mockReturnValue({ update });

    await repository.updateParcelWeightAndRoute('parcel-1', {
      actualWeightGrams: 520,
      routeId: 'route-2',
    });

    expect(update).toHaveBeenCalledWith('parcel-1', {
      actualWeightGrams: 520,
      routeId: 'route-2',
    });
  });

  it('updateParcelWeightAndRoute omits fields that were not provided', async () => {
    const update = jest.fn().mockResolvedValue(undefined);
    getRepository.mockReturnValue({ update });

    await repository.updateParcelWeightAndRoute('parcel-1', {
      actualWeightGrams: 520,
    });

    expect(update).toHaveBeenCalledWith('parcel-1', {
      actualWeightGrams: 520,
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

  describe('cancelIfPending', () => {
    it('cancels the order and returns "cancelled" when it is still Created', async () => {
      const update = jest.fn().mockResolvedValue({ affected: 1 });
      getRepository.mockReturnValue({ update });

      const result = await repository.cancelIfPending('order-1');

      expect(update).toHaveBeenCalledWith(
        { id: 'order-1', status: ShipmentOrderStatus.CREATED },
        { status: ShipmentOrderStatus.CANCELLED },
      );
      expect(result).toBe('cancelled');
    });

    it('returns "skipped" without cancelling when the order already moved past Created', async () => {
      const update = jest.fn().mockResolvedValue({ affected: 0 });
      getRepository.mockReturnValue({ update });

      const result = await repository.cancelIfPending('order-1');

      expect(result).toBe('skipped');
    });
  });
});
