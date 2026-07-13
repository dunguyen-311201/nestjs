import { PaymentRepository } from './payment.repository';
import { Payment } from '../entities/payment.entity';
import { PaymentStatus } from '../entities/payment-status.enum';
import { ShipmentOrder } from '../entities/shipment-order.entity';
import { ShipmentOrderStatus } from '../entities/shipment-order-status.enum';

describe('PaymentRepository', () => {
  let findOne: jest.Mock;
  let getRepository: jest.Mock;
  let dataSource: { transaction: jest.Mock; getRepository: jest.Mock };
  let repository: PaymentRepository;

  beforeEach(() => {
    findOne = jest.fn();
    getRepository = jest.fn().mockReturnValue({ findOne });
    dataSource = {
      transaction: jest.fn(),
      getRepository,
    };
    repository = new PaymentRepository(dataSource as never);
  });

  describe('findByShipmentOrderId', () => {
    it('reads a payment by shipment_order_id', async () => {
      findOne.mockResolvedValue({
        id: 'payment-1',
        shipmentOrderId: 'order-1',
        status: PaymentStatus.UNPAID,
      });

      const result = await repository.findByShipmentOrderId('order-1');

      expect(getRepository).toHaveBeenCalledWith(Payment);
      expect(findOne).toHaveBeenCalledWith({
        where: { shipmentOrderId: 'order-1' },
      });
      expect(result?.id).toBe('payment-1');
    });
  });

  describe('confirmPayment', () => {
    function transactionManager() {
      const insert = jest.fn();
      const orIgnore = jest.fn().mockReturnValue({ execute: insert });
      const values = jest.fn().mockReturnValue({ orIgnore });
      const into = jest.fn().mockReturnValue({ values });
      const createQueryBuilder = jest
        .fn()
        .mockReturnValue({ insert: () => ({ into }) });
      const paymentFindOne = jest
        .fn()
        .mockResolvedValue({ id: 'payment-1', shipmentOrderId: 'order-1' });
      const paymentUpdate = jest.fn().mockResolvedValue(undefined);
      const orderUpdate = jest.fn().mockResolvedValue(undefined);
      const managerGetRepository = jest.fn().mockImplementation((entity) => {
        if (entity === Payment) {
          return { findOne: paymentFindOne, update: paymentUpdate };
        }
        if (entity === ShipmentOrder) {
          return { update: orderUpdate };
        }
        throw new Error(`Unexpected repository target: ${String(entity)}`);
      });
      return {
        manager: {
          createQueryBuilder,
          getRepository: managerGetRepository,
        },
        insert,
        paymentFindOne,
        paymentUpdate,
        orderUpdate,
      };
    }

    it('writes the PAYMENT_TRANSACTION, marks PAYMENT paid, and confirms the order when new', async () => {
      const { manager, insert, paymentUpdate, orderUpdate } =
        transactionManager();
      insert.mockResolvedValue({ identifiers: [{ id: 'txn-1' }] });
      dataSource.transaction.mockImplementation((cb: (m: unknown) => unknown) =>
        cb(manager),
      );

      const result = await repository.confirmPayment({
        shipmentOrderId: 'order-1',
        provider: 'STRIPE',
        externalTransactionId: 'evt-1',
        externalReferenceId: 'pi_123',
        status: 'succeeded',
      });

      expect(result).toBe('confirmed');
      expect(paymentUpdate).toHaveBeenCalledWith('payment-1', {
        status: PaymentStatus.PAID,
      });
      expect(orderUpdate).toHaveBeenCalledWith('order-1', {
        status: ShipmentOrderStatus.CONFIRMED,
      });
    });

    it('returns duplicate and writes nothing else when external_transaction_id already exists', async () => {
      const { manager, insert, paymentUpdate, orderUpdate } =
        transactionManager();
      insert.mockResolvedValue({ identifiers: [] });
      dataSource.transaction.mockImplementation((cb: (m: unknown) => unknown) =>
        cb(manager),
      );

      const result = await repository.confirmPayment({
        shipmentOrderId: 'order-1',
        provider: 'STRIPE',
        externalTransactionId: 'evt-1',
        externalReferenceId: 'pi_123',
        status: 'succeeded',
      });

      expect(result).toBe('duplicate');
      expect(paymentUpdate).not.toHaveBeenCalled();
      expect(orderUpdate).not.toHaveBeenCalled();
    });
  });
});
