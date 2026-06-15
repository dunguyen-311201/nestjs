import { Test } from '@nestjs/testing';
import { INestApplication } from '@nestjs/common';
import {
  ClientsModule,
  MicroserviceOptions,
  Transport,
} from '@nestjs/microservices';
import { OrderController } from '../src/order.controller';
import { OrderService } from '../src/order.service';
import { InventoryController } from '../../inventory/src/inventory.controller';
import { InventoryService } from '../../inventory/src/inventory.service';
import { OrderStatus } from '@app/shared';

// Isolated test ports — do not reuse production ports (3001/3002/8001/8002)
const ORDER_TCP_PORT = 9001;
const INVENTORY_TCP_PORT = 9002;

const waitFor = (condition: () => boolean, timeout = 2000): Promise<void> =>
  new Promise((resolve, reject) => {
    const deadline = Date.now() + timeout;
    const poll = () => {
      if (condition()) return resolve();
      if (Date.now() > deadline) return reject(new Error('waitFor timeout'));
      setTimeout(poll, 50);
    };
    poll();
  });

describe('Cross-Service Communication (Integration)', () => {
  let orderApp: INestApplication;
  let inventoryApp: INestApplication;
  let orderService: OrderService;

  beforeAll(async () => {
    // --- Inventory app ---
    const inventoryModule = await Test.createTestingModule({
      controllers: [InventoryController],
      providers: [InventoryService],
      imports: [
        ClientsModule.register([
          {
            name: 'ORDER_SERVICE',
            transport: Transport.TCP,
            options: { host: 'localhost', port: ORDER_TCP_PORT },
          },
        ]),
      ],
    }).compile();

    inventoryApp = inventoryModule.createNestApplication();
    inventoryApp.connectMicroservice<MicroserviceOptions>({
      transport: Transport.TCP,
      options: { host: 'localhost', port: INVENTORY_TCP_PORT },
    });

    await inventoryApp.startAllMicroservices();
    await inventoryApp.init();

    // --- Order app ---
    const orderModule = await Test.createTestingModule({
      controllers: [OrderController],
      providers: [OrderService],
      imports: [
        ClientsModule.register([
          {
            name: 'INVENTORY_SERVICE',
            transport: Transport.TCP,
            options: { host: 'localhost', port: INVENTORY_TCP_PORT },
          },
        ]),
      ],
    }).compile();

    orderApp = orderModule.createNestApplication();
    orderApp.connectMicroservice<MicroserviceOptions>({
      transport: Transport.TCP,
      options: { host: 'localhost', port: ORDER_TCP_PORT },
    });

    await orderApp.startAllMicroservices();
    await orderApp.init();

    orderService = orderApp.get(OrderService);
  });

  afterAll(async () => {
    await orderApp.close();
    await inventoryApp.close();
  });

  describe('order_created → order_processed round-trip', () => {
    const statusOf = (id: string) =>
      orderService.getOrders().find((o) => o.id === id)?.status;

    it('should set order status to COMPLETED when product exists and stock is sufficient', async () => {
      const order = orderService.createOrder({
        name: 'Alice',
        product: 'Product 1',
        price: 10,
        quantity: 1,
      });

      await waitFor(() => statusOf(order.id) !== OrderStatus.PENDING);
      expect(statusOf(order.id)).toBe(OrderStatus.COMPLETED);
    });

    it('should set order status to CANCELLED when quantity exceeds stock', async () => {
      const order = orderService.createOrder({
        name: 'Bob',
        product: 'Product 1',
        price: 10,
        quantity: 9999,
      });

      await waitFor(() => statusOf(order.id) !== OrderStatus.PENDING);
      expect(statusOf(order.id)).toBe(OrderStatus.CANCELLED);
    });

    it('should set order status to CANCELLED when product does not exist in inventory', async () => {
      const order = orderService.createOrder({
        name: 'Carol',
        product: 'Ghost Product',
        price: 5,
        quantity: 1,
      });

      await waitFor(() => statusOf(order.id) !== OrderStatus.PENDING);
      expect(statusOf(order.id)).toBe(OrderStatus.CANCELLED);
    });

    it('should handle multiple concurrent orders independently', async () => {
      // Product 2 has 200 units — two simultaneous orders of 1 each should both complete
      const [orderA, orderB] = [
        orderService.createOrder({
          name: 'Dave',
          product: 'Product 2',
          price: 20,
          quantity: 1,
        }),
        orderService.createOrder({
          name: 'Eve',
          product: 'Product 2',
          price: 20,
          quantity: 1,
        }),
      ];

      await waitFor(
        () =>
          statusOf(orderA.id) !== OrderStatus.PENDING &&
          statusOf(orderB.id) !== OrderStatus.PENDING,
      );

      expect(statusOf(orderA.id)).toBe(OrderStatus.COMPLETED);
      expect(statusOf(orderB.id)).toBe(OrderStatus.COMPLETED);
    });

    it('should deplete stock across sequential orders and fail the last one', async () => {
      // Product 3 has 300 units — consume all then verify next order fails
      const bigOrder = orderService.createOrder({
        name: 'Frank',
        product: 'Product 3',
        price: 30,
        quantity: 300,
      });

      await waitFor(() => statusOf(bigOrder.id) !== OrderStatus.PENDING);
      expect(statusOf(bigOrder.id)).toBe(OrderStatus.COMPLETED);

      // Now stock is 0 — next order should be cancelled
      const overflow = orderService.createOrder({
        name: 'Frank',
        product: 'Product 3',
        price: 30,
        quantity: 1,
      });

      await waitFor(() => statusOf(overflow.id) !== OrderStatus.PENDING);
      expect(statusOf(overflow.id)).toBe(OrderStatus.CANCELLED);
    });
  });
});
