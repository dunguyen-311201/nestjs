import { Test, TestingModule } from '@nestjs/testing';
import { InventoryController } from './inventory.controller';
import { InventoryService } from './inventory.service';
import { ClientProxy } from '@nestjs/microservices';
import { Order, OrderStatus } from '@app/shared';

const mockOrderClient: jest.Mocked<Pick<ClientProxy, 'emit'>> = {
  emit: jest.fn().mockReturnValue({ subscribe: jest.fn() }),
};

const makeOrder = (overrides: Partial<Order> = {}): Order => ({
  id: '1',
  name: 'Alice',
  product: 'Product 1',
  price: 10,
  quantity: 1,
  status: OrderStatus.PENDING,
  ...overrides,
});

describe('InventoryController', () => {
  let controller: InventoryController;
  let service: InventoryService;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      controllers: [InventoryController],
      providers: [
        InventoryService,
        { provide: 'ORDER_SERVICE', useValue: mockOrderClient },
      ],
    }).compile();

    controller = module.get<InventoryController>(InventoryController);
    service = module.get<InventoryService>(InventoryService);
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

  describe('handleOrderCreated', () => {
    it('should delegate to service and emit order_processed event', () => {
      const emitSpy = jest.spyOn(service, 'handleOrderCreated');
      const order = makeOrder();

      controller.handleOrderCreated(order);

      expect(emitSpy).toHaveBeenCalledWith(order);
      expect(mockOrderClient.emit).toHaveBeenCalledTimes(1);
    });

    it('should return undefined (event handler has no return value)', () => {
      const result = controller.handleOrderCreated(makeOrder());

      expect(result).toBeUndefined();
    });
  });
});
