import { Test, TestingModule } from '@nestjs/testing';
import { getRepositoryToken } from '@nestjs/typeorm';
import { Order } from '@app/shared';
import { Product } from './entities/product.entity';
import { Reservation, ReservationStatus } from './entities/reservation.entity';
import { ReservationService } from './reservation.service';

const mockProductRepo = () => ({ findOne: jest.fn() });
const mockReservationRepo = () => ({
  sum: jest.fn(),
  create: jest.fn(),
  save: jest.fn(),
});

const makeProduct = (id: string, stock: number): Partial<Product> => ({
  id,
  stock,
});

const makeOrder = (
  items: { productId: string; quantity: number }[] = [
    { productId: 'prod-uuid', quantity: 5 },
  ],
): Order => ({ id: 'order-uuid', items });

describe('ReservationService', () => {
  let service: ReservationService;
  let productRepo: ReturnType<typeof mockProductRepo>;
  let reservationRepo: ReturnType<typeof mockReservationRepo>;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        ReservationService,
        { provide: getRepositoryToken(Product), useFactory: mockProductRepo },
        {
          provide: getRepositoryToken(Reservation),
          useFactory: mockReservationRepo,
        },
      ],
    }).compile();

    service = module.get<ReservationService>(ReservationService);
    productRepo = module.get(getRepositoryToken(Product));
    reservationRepo = module.get(getRepositoryToken(Reservation));
    jest.clearAllMocks();
  });

  describe('checkAndReserve', () => {
    it('should create reservations and return success when stock is sufficient', async () => {
      productRepo.findOne.mockResolvedValue(makeProduct('prod-uuid', 100));
      reservationRepo.sum.mockResolvedValue(10);
      const stubReservation = { id: 'res-uuid' };
      reservationRepo.create.mockReturnValue(stubReservation);
      reservationRepo.save.mockResolvedValue(stubReservation);

      const result = await service.checkAndReserve(makeOrder());

      expect(reservationRepo.save).toHaveBeenCalledTimes(1);
      expect(result).toEqual({
        success: true,
        message: 'Order processed successfully',
      });
    });

    it('should return failure and skip saving when a product is not found', async () => {
      productRepo.findOne.mockResolvedValue(null);

      const result = await service.checkAndReserve(
        makeOrder([{ productId: 'ghost-uuid', quantity: 1 }]),
      );

      expect(reservationRepo.save).not.toHaveBeenCalled();
      expect(result).toEqual({
        success: false,
        message: 'Product ghost-uuid not found',
      });
    });

    it('should return failure when available stock is below requested quantity', async () => {
      productRepo.findOne.mockResolvedValue(makeProduct('prod-uuid', 10));
      reservationRepo.sum.mockResolvedValue(8);

      const result = await service.checkAndReserve(
        makeOrder([{ productId: 'prod-uuid', quantity: 5 }]),
      );

      expect(reservationRepo.save).not.toHaveBeenCalled();
      expect(result).toEqual({
        success: false,
        message: 'Insufficient stock for product prod-uuid',
      });
    });

    it('should treat null pending reservations as zero', async () => {
      productRepo.findOne.mockResolvedValue(makeProduct('prod-uuid', 20));
      reservationRepo.sum.mockResolvedValue(null);
      const stubReservation = { id: 'res-uuid' };
      reservationRepo.create.mockReturnValue(stubReservation);
      reservationRepo.save.mockResolvedValue(stubReservation);

      const result = await service.checkAndReserve(
        makeOrder([{ productId: 'prod-uuid', quantity: 20 }]),
      );

      expect(result.success).toBe(true);
    });

    it('should fail on the first insufficient item without saving any reservation', async () => {
      productRepo.findOne
        .mockResolvedValueOnce(makeProduct('prod-1', 5))
        .mockResolvedValueOnce(makeProduct('prod-2', 50));
      reservationRepo.sum.mockResolvedValueOnce(3).mockResolvedValueOnce(0);

      const result = await service.checkAndReserve(
        makeOrder([
          { productId: 'prod-1', quantity: 10 },
          { productId: 'prod-2', quantity: 5 },
        ]),
      );

      expect(reservationRepo.save).not.toHaveBeenCalled();
      expect(result.success).toBe(false);
    });

    it('should create one reservation per order item', async () => {
      productRepo.findOne
        .mockResolvedValueOnce(makeProduct('prod-1', 100))
        .mockResolvedValueOnce(makeProduct('prod-2', 100));
      reservationRepo.sum.mockResolvedValue(0);
      const stub = { id: 'res-uuid' };
      reservationRepo.create.mockReturnValue(stub);
      reservationRepo.save.mockResolvedValue(stub);

      await service.checkAndReserve(
        makeOrder([
          { productId: 'prod-1', quantity: 3 },
          { productId: 'prod-2', quantity: 7 },
        ]),
      );

      expect(reservationRepo.save).toHaveBeenCalledTimes(2);
      expect(reservationRepo.create).toHaveBeenCalledWith(
        expect.objectContaining({ status: ReservationStatus.PENDING }),
      );
    });
  });
});
