import { Test, TestingModule } from '@nestjs/testing';
import { InventoryService } from './inventory.service';
import { ClientProxy } from '@nestjs/microservices';
import { EVENTS } from '@app/constants';
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

describe('InventoryService', () => {
  let service: InventoryService;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        InventoryService,
        { provide: 'ORDER_SERVICE', useValue: mockOrderClient },
      ],
    }).compile();

    service = module.get<InventoryService>(InventoryService);
    jest.clearAllMocks();
  });

  describe('getHello', () => {
    it('should return "Hello World!"', () => {
      expect(service.getHello()).toBe('Hello World!');
    });
  });

  describe('handleOrderCreated', () => {
    it('should decrement inventory quantity when product exists and stock is sufficient', () => {
      const order = makeOrder({ product: 'Product 1', quantity: 10 });

      service.handleOrderCreated(order);

      expect(mockOrderClient.emit).toHaveBeenCalledWith(
        EVENTS.ORDER_PROCESSED,
        expect.objectContaining({ orderId: '1', success: true }),
      );
    });

    it('should emit success=true and correct message on successful processing', () => {
      const order = makeOrder({ product: 'Product 1', quantity: 1 });

      service.handleOrderCreated(order);

      expect(mockOrderClient.emit).toHaveBeenCalledWith(
        EVENTS.ORDER_PROCESSED,
        {
          orderId: order.id,
          success: true,
          message: 'Order processed successfully',
        },
      );
    });

    it('should emit success=false when quantity is insufficient', () => {
      const order = makeOrder({ product: 'Product 1', quantity: 9999 });

      service.handleOrderCreated(order);

      expect(mockOrderClient.emit).toHaveBeenCalledWith(
        EVENTS.ORDER_PROCESSED,
        {
          orderId: order.id,
          success: false,
          message: 'Insufficient quantity in inventory',
        },
      );
    });

    it('should not modify inventory when quantity is insufficient', () => {
      const order = makeOrder({ product: 'Product 1', quantity: 9999 });

      service.handleOrderCreated(order);

      // Verify stock was  not changed by processing valid order after
      const followUp = makeOrder({
        id: '2',
        product: 'Product 1',
        quantity: 1,
      });
      service.handleOrderCreated(followUp);

      expect(mockOrderClient.emit).toHaveBeenNthCalledWith(
        2,
        EVENTS.ORDER_PROCESSED,
        expect.objectContaining({ success: true }),
      );
    });

    it('should emit success=false when product does not exist in inventory', () => {
      const order = makeOrder({ product: 'Unknown Product' });

      service.handleOrderCreated(order);

      expect(mockOrderClient.emit).toHaveBeenCalledWith(
        EVENTS.ORDER_PROCESSED,
        {
          orderId: order.id,
          success: false,
          message: 'Product Unknown Product not found in inventory',
        },
      );
    });

    it('should emit exactly once per order', () => {
      const order = makeOrder();

      service.handleOrderCreated(order);

      expect(mockOrderClient.emit).toHaveBeenCalledTimes(1);
    });

    it('should reduce inventory across multiple orders', () => {
      const first = makeOrder({ id: '1', product: 'Product 2', quantity: 100 });
      const second = makeOrder({
        id: '2',
        product: 'Product 2',
        quantity: 100,
      });
      const third = makeOrder({ id: '3', product: 'Product 2', quantity: 1 });

      service.handleOrderCreated(first);
      service.handleOrderCreated(second);
      service.handleOrderCreated(third);

      // first two consume 200 (full stock), third should fail
      expect(mockOrderClient.emit).toHaveBeenNthCalledWith(
        3,
        EVENTS.ORDER_PROCESSED,
        expect.objectContaining({ success: false }),
      );
    });
  });
});
