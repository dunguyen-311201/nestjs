import { Test, TestingModule } from '@nestjs/testing';
import { OrderService } from './order.service';
import { OrderStatus } from '@app/shared';
import { ClientProxy } from '@nestjs/microservices';

const mockInventoryClient: jest.Mocked<Pick<ClientProxy, 'emit'>> = {
  emit: jest.fn().mockReturnValue({ subscribe: jest.fn() }),
};

describe('OrderService', () => {
  let service: OrderService;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        OrderService,
        { provide: 'INVENTORY_SERVICE', useValue: mockInventoryClient },
      ],
    }).compile();

    service = module.get<OrderService>(OrderService);
    jest.clearAllMocks();
  });

  describe('getHello', () => {
    it('should return "Hello World!"', () => {
      expect(service.getHello()).toBe('Hello World!');
    });
  });

  describe('createOrder', () => {
    it('should create an order with PENDING status and auto-generated id', () => {
      const input = {
        name: 'Alice',
        product: 'Widget',
        price: 10,
        quantity: 2,
      };

      const order = service.createOrder(input);

      expect(order).toMatchObject({
        ...input,
        id: '1',
        status: OrderStatus.PENDING,
      });
    });

    it('should increment id for each new order', () => {
      const input = {
        name: 'Alice',
        product: 'Widget',
        price: 10,
        quantity: 1,
      };

      const first = service.createOrder(input);
      const second = service.createOrder(input);

      expect(first.id).toBe('1');
      expect(second.id).toBe('2');
    });

    it('should persist the order so getOrders returns it', () => {
      const input = {
        name: 'Alice',
        product: 'Widget',
        price: 10,
        quantity: 1,
      };

      const order = service.createOrder(input);

      expect(service.getOrders()).toContainEqual(order);
    });

    it('should emit order_created event to inventory service', () => {
      const input = {
        name: 'Alice',
        product: 'Widget',
        price: 10,
        quantity: 1,
      };

      const order = service.createOrder(input);

      expect(mockInventoryClient.emit).toHaveBeenCalledTimes(1);
      expect(mockInventoryClient.emit).toHaveBeenCalledWith(
        'order_created',
        order,
      );
    });
  });

  describe('getOrders', () => {
    it('should return an empty array when no orders exist', () => {
      expect(service.getOrders()).toEqual([]);
    });

    it('should return all created orders', () => {
      const input = {
        name: 'Alice',
        product: 'Widget',
        price: 10,
        quantity: 1,
      };
      service.createOrder(input);
      service.createOrder({ ...input, name: 'Bob' });

      expect(service.getOrders()).toHaveLength(2);
    });
  });

  describe('handleOrderProcessed', () => {
    it('should set order status to COMPLETED when success is true', () => {
      const order = service.createOrder({
        name: 'Alice',
        product: 'Widget',
        price: 10,
        quantity: 1,
      });

      service.handleOrderProcessed({
        orderId: order.id,
        success: true,
        message: 'ok',
      });

      expect(service.getOrders()[0].status).toBe(OrderStatus.COMPLETED);
    });

    it('should set order status to CANCELLED when success is false', () => {
      const order = service.createOrder({
        name: 'Alice',
        product: 'Widget',
        price: 10,
        quantity: 1,
      });

      service.handleOrderProcessed({
        orderId: order.id,
        success: false,
        message: 'failed',
      });

      expect(service.getOrders()[0].status).toBe(OrderStatus.CANCELLED);
    });

    it('should not change any order when orderId does not exist', () => {
      service.createOrder({
        name: 'Alice',
        product: 'Widget',
        price: 10,
        quantity: 1,
      });

      service.handleOrderProcessed({
        orderId: 'nonexistent',
        success: true,
        message: 'ok',
      });

      expect(service.getOrders()[0].status).toBe(OrderStatus.PENDING);
    });
  });
});
