import { Test, TestingModule } from '@nestjs/testing';
import { OrderController } from './order.controller';
import { OrderService } from './order.service';
import { OrderStatus } from '@app/shared';
import { ClientProxy } from '@nestjs/microservices';

const mockInventoryClient: jest.Mocked<Pick<ClientProxy, 'emit'>> = {
  emit: jest.fn().mockReturnValue({ subscribe: jest.fn() }),
};

describe('OrderController', () => {
  let controller: OrderController;
  let service: OrderService;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      controllers: [OrderController],
      providers: [
        OrderService,
        { provide: 'INVENTORY_SERVICE', useValue: mockInventoryClient },
      ],
    }).compile();

    controller = module.get<OrderController>(OrderController);
    service = module.get<OrderService>(OrderService);
    jest.clearAllMocks();
  });

  describe('getHello', () => {
    it('should return "Hello World!"', () => {
      expect(controller.getHello()).toBe('Hello World!');
    });
  });

  describe('healthCheck', () => {
    it('should return { status: "ok" }', () => {
      expect(controller.healthCheck()).toEqual({ status: 'ok' });
    });
  });

  describe('createOrder', () => {
    it('should return the created order', () => {
      const input = { name: 'Alice', product: 'Widget', price: 10, quantity: 1 };

      const result = controller.createOrder(input);

      expect(result).toMatchObject({ ...input, status: OrderStatus.PENDING });
    });
  });

  describe('getOrders', () => {
    it('should return all orders', () => {
      const input = { name: 'Alice', product: 'Widget', price: 10, quantity: 1 };
      service.createOrder(input);
      service.createOrder(input);

      expect(controller.getOrders()).toHaveLength(2);
    });
  });

  describe('handleOrderProcessed', () => {
    it('should delegate to service without returning a value', () => {
      const order = service.createOrder({
        name: 'Alice',
        product: 'Widget',
        price: 10,
        quantity: 1,
      });

      const result = controller.handleOrderProcessed({
        orderId: order.id,
        success: true,
        message: 'ok',
      });

      expect(result).toBeUndefined();
      expect(service.getOrders()[0].status).toBe(OrderStatus.COMPLETED);
    });
  });
});
