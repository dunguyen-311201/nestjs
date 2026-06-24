import { ForbiddenException, NotFoundException } from '@nestjs/common';
import { CACHE_MANAGER } from '@nestjs/cache-manager';
import { Test, type TestingModule } from '@nestjs/testing';
import { getRepositoryToken } from '@nestjs/typeorm';
import { UserRole } from '@app/shared';
import { CategoriesService } from './categories.service';
import { Product } from './entities/product.entity';
import { ProductsService } from './products.service';

const baseProduct = (overrides: Partial<Product> = {}): Product => ({
  id: 'prod-1',
  name: 'Widget',
  description: null,
  price: 9.99,
  stock: 10,
  image: 'no-image.png',
  specs: {},
  category: null,
  ownerId: null,
  createdAt: new Date(),
  updatedAt: new Date(),
  ...overrides,
});

const mockRepository = {
  create: jest.fn(),
  save: jest.fn(),
  find: jest.fn(),
  findOne: jest.fn(),
  remove: jest.fn(),
};

const mockCategoriesService = {
  findOne: jest.fn(),
};

const mockCacheManager = {
  del: jest.fn(),
};

const admin = { sub: 'admin-uuid', username: 'root', role: UserRole.ADMIN };
const merchant = {
  sub: 'merchant-uuid',
  username: 'shopkeeper',
  role: UserRole.MERCHANT,
};
const otherMerchant = {
  sub: 'other-merchant-uuid',
  username: 'rival',
  role: UserRole.MERCHANT,
};

describe('ProductsService', () => {
  let service: ProductsService;

  beforeEach(async () => {
    jest.clearAllMocks();
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        ProductsService,
        { provide: getRepositoryToken(Product), useValue: mockRepository },
        { provide: CategoriesService, useValue: mockCategoriesService },
        { provide: CACHE_MANAGER, useValue: mockCacheManager },
      ],
    }).compile();

    service = module.get<ProductsService>(ProductsService);
  });

  describe('create', () => {
    it('should tag the product with the merchant as owner', async () => {
      const product = baseProduct({ ownerId: merchant.sub });
      mockRepository.create.mockReturnValue(product);
      mockRepository.save.mockResolvedValue(product);

      await service.create({ name: 'Widget', price: 9.99 }, merchant);

      expect(mockRepository.create).toHaveBeenCalledWith(
        expect.objectContaining({ ownerId: merchant.sub }),
      );
    });

    it('should leave the product unowned when created by an admin', async () => {
      const product = baseProduct();
      mockRepository.create.mockReturnValue(product);
      mockRepository.save.mockResolvedValue(product);

      await service.create({ name: 'Widget', price: 9.99 }, admin);

      expect(mockRepository.create).toHaveBeenCalledWith(
        expect.objectContaining({ ownerId: null }),
      );
    });

    it('should invalidate the products list cache', async () => {
      const product = baseProduct();
      mockRepository.create.mockReturnValue(product);
      mockRepository.save.mockResolvedValue(product);

      await service.create({ name: 'Widget', price: 9.99 }, admin);

      expect(mockCacheManager.del).toHaveBeenCalledWith('/v1/products');
    });
  });

  describe('update', () => {
    it('should allow an admin to update any product', async () => {
      const product = baseProduct({ ownerId: merchant.sub });
      mockRepository.findOne.mockResolvedValue(product);
      mockRepository.save.mockResolvedValue(product);

      await expect(
        service.update('prod-1', { name: 'New name' }, admin),
      ).resolves.toBeDefined();
    });

    it('should allow a merchant to update their own product', async () => {
      const product = baseProduct({ ownerId: merchant.sub });
      mockRepository.findOne.mockResolvedValue(product);
      mockRepository.save.mockResolvedValue(product);

      await expect(
        service.update('prod-1', { name: 'New name' }, merchant),
      ).resolves.toBeDefined();
    });

    it("should throw ForbiddenException when a merchant updates another merchant's product", async () => {
      const product = baseProduct({ ownerId: merchant.sub });
      mockRepository.findOne.mockResolvedValue(product);

      await expect(
        service.update('prod-1', { name: 'New name' }, otherMerchant),
      ).rejects.toThrow(ForbiddenException);
    });

    it('should throw NotFoundException when the product does not exist', async () => {
      mockRepository.findOne.mockResolvedValue(null);

      await expect(
        service.update('missing', { name: 'New name' }, admin),
      ).rejects.toThrow(NotFoundException);
    });

    it('should invalidate the detail and list cache entries', async () => {
      const product = baseProduct({ ownerId: merchant.sub });
      mockRepository.findOne.mockResolvedValue(product);
      mockRepository.save.mockResolvedValue(product);

      await service.update('prod-1', { name: 'New name' }, admin);

      expect(mockCacheManager.del).toHaveBeenCalledWith('/v1/products/prod-1');
      expect(mockCacheManager.del).toHaveBeenCalledWith('/v1/products');
    });
  });

  describe('remove', () => {
    it('should allow an admin to remove any product', async () => {
      const product = baseProduct({ ownerId: merchant.sub });
      mockRepository.findOne.mockResolvedValue(product);

      await expect(service.remove('prod-1', admin)).resolves.toBeUndefined();
      expect(mockRepository.remove).toHaveBeenCalledWith(product);
    });

    it('should allow a merchant to remove their own product', async () => {
      const product = baseProduct({ ownerId: merchant.sub });
      mockRepository.findOne.mockResolvedValue(product);

      await expect(service.remove('prod-1', merchant)).resolves.toBeUndefined();
    });

    it("should throw ForbiddenException when a merchant removes another merchant's product", async () => {
      const product = baseProduct({ ownerId: merchant.sub });
      mockRepository.findOne.mockResolvedValue(product);

      await expect(service.remove('prod-1', otherMerchant)).rejects.toThrow(
        ForbiddenException,
      );
    });

    it('should throw ForbiddenException when a regular user attempts to remove a product', async () => {
      const product = baseProduct();
      mockRepository.findOne.mockResolvedValue(product);
      const regularUser = {
        sub: 'user-uuid',
        username: 'bob',
        role: UserRole.USER,
      };

      await expect(service.remove('prod-1', regularUser)).rejects.toThrow(
        ForbiddenException,
      );
    });

    it('should invalidate the detail and list cache entries', async () => {
      const product = baseProduct({ ownerId: merchant.sub });
      mockRepository.findOne.mockResolvedValue(product);

      await service.remove('prod-1', admin);

      expect(mockCacheManager.del).toHaveBeenCalledWith('/v1/products/prod-1');
      expect(mockCacheManager.del).toHaveBeenCalledWith('/v1/products');
    });
  });
});
