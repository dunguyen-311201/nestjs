import { NotFoundException } from '@nestjs/common';
import { Test, TestingModule } from '@nestjs/testing';
import { getRepositoryToken } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { Order, OrderStatus } from './entities/order.entity';
import { OrderItem } from './entities/order-item.entity';
import { OrderService } from './order.service';

const mockRepo = () => ({
  create: jest.fn(),
  save: jest.fn(),
  find: jest.fn(),
  findOne: jest.fn(),
});

const mockInventoryClient = { emit: jest.fn() };

const baseItem = (): OrderItem => ({
  id: 'item-uuid',
  productId: 'prod-uuid',
  quantity: 2,
  unitPrice: 10,
  order: null as unknown as Order,
});

const baseOrder = (): Order => ({
  id: 'uuid-1',
  customerId: 'user-uuid',
  totalPrice: 20,
  status: OrderStatus.PENDING,
  createdAt: new Date(),
  items: [baseItem()],
});

describe('OrderService', () => {
  let service: OrderService;
  let repo: jest.Mocked<
    Pick<Repository<Order>, 'create' | 'save' | 'find' | 'findOne'>
  >;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        OrderService,
        { provide: getRepositoryToken(Order), useFactory: mockRepo },
        { provide: 'INVENTORY_SERVICE', useValue: mockInventoryClient },
      ],
    }).compile();

    service = module.get<OrderService>(OrderService);
    repo = module.get(getRepositoryToken(Order));
    jest.clearAllMocks();
  });

  describe('create', () => {
    it('should compute totalPrice from items and save a PENDING order', async () => {
      const dto = {
        customerId: 'user-uuid',
        items: [
          { productId: 'prod-1', quantity: 2, unitPrice: 10 },
          { productId: 'prod-2', quantity: 1, unitPrice: 25 },
        ],
      };
      const order = baseOrder();
      (repo.create as jest.Mock).mockReturnValue(order);
      (repo.save as jest.Mock).mockResolvedValue(order);

      const result = await service.create(dto);

      expect(repo.create).toHaveBeenCalledWith(
        expect.objectContaining({
          totalPrice: 45,
          status: OrderStatus.PENDING,
        }),
      );
      expect(result.status).toBe(OrderStatus.PENDING);
    });

    it('should emit ORDER_CREATED after saving', async () => {
      const dto = {
        customerId: 'user-uuid',
        items: [{ productId: 'prod-uuid', quantity: 1, unitPrice: 9.99 }],
      };
      const order = baseOrder();
      (repo.create as jest.Mock).mockReturnValue(order);
      (repo.save as jest.Mock).mockResolvedValue(order);

      await service.create(dto);

      expect(mockInventoryClient.emit).toHaveBeenCalledWith(
        'order_created',
        order,
      );
    });
  });

  describe('findAll', () => {
    it('should return orders with items relation and default pagination', async () => {
      const orders = [baseOrder()];
      (repo.find as jest.Mock).mockResolvedValue(orders);

      const result = await service.findAll();

      expect(repo.find).toHaveBeenCalledWith({
        relations: ['items'],
        order: { createdAt: 'DESC' },
        skip: 0,
        take: 10,
      });
      expect(result).toEqual(orders);
    });

    it('should apply page and limit when provided', async () => {
      (repo.find as jest.Mock).mockResolvedValue([]);

      await service.findAll(2, 5);

      expect(repo.find).toHaveBeenCalledWith(
        expect.objectContaining({ skip: 5, take: 5 }),
      );
    });
  });

  describe('findOne', () => {
    it('should return the order with items when found', async () => {
      const order = baseOrder();
      (repo.findOne as jest.Mock).mockResolvedValue(order);

      const result = await service.findOne('uuid-1');

      expect(repo.findOne).toHaveBeenCalledWith({
        where: { id: 'uuid-1' },
        relations: ['items'],
      });
      expect(result).toEqual(order);
    });

    it('should throw NotFoundException when order does not exist', async () => {
      (repo.findOne as jest.Mock).mockResolvedValue(null);

      await expect(service.findOne('missing')).rejects.toThrow(
        NotFoundException,
      );
    });
  });

  describe('handleOrderProcessed', () => {
    it('should set status to APPROVED when success is true', async () => {
      const order = baseOrder();
      (repo.findOne as jest.Mock).mockResolvedValue(order);
      (repo.save as jest.Mock).mockResolvedValue({
        ...order,
        status: OrderStatus.APPROVED,
      });

      await service.handleOrderProcessed({
        orderId: 'uuid-1',
        success: true,
        message: 'ok',
      });

      expect(repo.save).toHaveBeenCalledWith(
        expect.objectContaining({ status: OrderStatus.APPROVED }),
      );
    });

    it('should set status to DECLINED when success is false', async () => {
      const order = baseOrder();
      (repo.findOne as jest.Mock).mockResolvedValue(order);

      await service.handleOrderProcessed({
        orderId: 'uuid-1',
        success: false,
        message: 'fail',
      });

      expect(repo.save).toHaveBeenCalledWith(
        expect.objectContaining({ status: OrderStatus.DECLINED }),
      );
    });

    it('should do nothing when order is not found', async () => {
      (repo.findOne as jest.Mock).mockResolvedValue(null);

      await service.handleOrderProcessed({
        orderId: 'missing',
        success: true,
        message: 'ok',
      });

      expect(repo.save).not.toHaveBeenCalled();
    });
  });
});
