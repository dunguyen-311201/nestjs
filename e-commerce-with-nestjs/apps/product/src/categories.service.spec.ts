import { ConflictException, NotFoundException } from '@nestjs/common';
import { CACHE_MANAGER } from '@nestjs/cache-manager';
import { Test, type TestingModule } from '@nestjs/testing';
import { getRepositoryToken } from '@nestjs/typeorm';
import { QueryFailedError } from 'typeorm';
import { CategoriesService } from './categories.service';
import { Category } from './entities/category.entity';

const mockCategory = {
  id: '1',
  name: 'Electronics',
  description: 'Gadgets',
} as Category;

const mockRepository = {
  create: jest.fn().mockReturnValue(mockCategory),
  save: jest.fn().mockResolvedValue(mockCategory),
  find: jest.fn().mockResolvedValue([mockCategory]),
  findOne: jest.fn().mockResolvedValue(mockCategory),
  remove: jest.fn().mockResolvedValue(mockCategory),
};

const mockCacheManager = {
  del: jest.fn(),
};

const duplicateKeyError = new QueryFailedError(
  'INSERT INTO "category" VALUES (...)',
  [],
  Object.assign(
    new Error(
      'duplicate key value violates unique constraint "UQ_23c05c292c439d77b0de816b500"',
    ),
    { code: '23505' },
  ),
);

describe('CategoriesService', () => {
  let service: CategoriesService;

  beforeEach(async () => {
    jest.clearAllMocks();
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        CategoriesService,
        {
          provide: getRepositoryToken(Category),
          useValue: mockRepository,
        },
        { provide: CACHE_MANAGER, useValue: mockCacheManager },
      ],
    }).compile();

    service = module.get<CategoriesService>(CategoriesService);
  });

  it('should be defined', () => {
    expect(service).toBeDefined();
  });

  it('create() should persist and return the new category', async () => {
    const dto = { name: 'Electronics', description: 'Gadgets' };
    const result = await service.create(dto);
    expect(mockRepository.create).toHaveBeenCalledWith(dto);
    expect(mockRepository.save).toHaveBeenCalledWith(mockCategory);
    expect(result).toEqual(mockCategory);
  });

  it('create() should invalidate the categories list cache', async () => {
    await service.create({ name: 'Electronics', description: 'Gadgets' });
    expect(mockCacheManager.del).toHaveBeenCalledWith('/v1/categories');
  });

  it('create() should throw ConflictException when the name already exists', async () => {
    mockRepository.save.mockRejectedValueOnce(duplicateKeyError);
    const dto = { name: 'Electronics' };
    await expect(service.create(dto)).rejects.toThrow(ConflictException);
  });

  it('create() should rethrow errors that are not unique violations', async () => {
    const dbError = new Error('connection refused');
    mockRepository.save.mockRejectedValueOnce(dbError);
    await expect(service.create({ name: 'Electronics' })).rejects.toThrow(
      dbError,
    );
  });

  it('findAll() should return all categories', async () => {
    const result = await service.findAll();
    expect(mockRepository.find).toHaveBeenCalled();
    expect(result).toEqual([mockCategory]);
  });

  it('findOne() should return a category by id', async () => {
    const result = await service.findOne('1');
    expect(mockRepository.findOne).toHaveBeenCalledWith({
      where: { id: '1' },
    });
    expect(result).toEqual(mockCategory);
  });

  it('findOne() should throw NotFoundException when category is not found', async () => {
    mockRepository.findOne.mockResolvedValueOnce(null);
    await expect(service.findOne('999')).rejects.toThrow(NotFoundException);
  });

  it('update() should merge the dto and save the category', async () => {
    const dto = { description: 'Updated' };
    const result = await service.update('1', dto);
    expect(mockRepository.save).toHaveBeenCalledWith({
      ...mockCategory,
      ...dto,
    });
    expect(result).toEqual(mockCategory);
  });

  it('update() should throw ConflictException when the name already exists', async () => {
    mockRepository.save.mockRejectedValueOnce(duplicateKeyError);
    await expect(service.update('1', { name: 'Taken' })).rejects.toThrow(
      ConflictException,
    );
  });

  it('update() should invalidate the detail and list cache entries', async () => {
    await service.update('1', { description: 'Updated' });
    expect(mockCacheManager.del).toHaveBeenCalledWith('/v1/categories/1');
    expect(mockCacheManager.del).toHaveBeenCalledWith('/v1/categories');
  });

  it('remove() should delete the category', async () => {
    await service.remove('1');
    expect(mockRepository.findOne).toHaveBeenCalledWith({
      where: { id: '1' },
    });
    expect(mockRepository.remove).toHaveBeenCalledWith(mockCategory);
  });

  it('remove() should invalidate the detail and list cache entries', async () => {
    await service.remove('1');
    expect(mockCacheManager.del).toHaveBeenCalledWith('/v1/categories/1');
    expect(mockCacheManager.del).toHaveBeenCalledWith('/v1/categories');
  });
});
