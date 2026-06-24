import {
  ConflictException,
  Inject,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { CACHE_MANAGER, type Cache } from '@nestjs/cache-manager';
import { InjectRepository } from '@nestjs/typeorm';
import { QueryFailedError, Repository } from 'typeorm';
import { CreateCategoryDto } from './dto/create-category.dto';
import { UpdateCategoryDto } from './dto/update-category.dto';
import { Category } from './entities/category.entity';

const CATEGORIES_LIST_CACHE_KEY = '/v1/categories';

interface PostgresDriverError extends Error {
  code: string;
}

function isUniqueViolation(error: unknown): boolean {
  return (
    error instanceof QueryFailedError &&
    (error.driverError as PostgresDriverError).code === '23505'
  );
}

@Injectable()
export class CategoriesService {
  constructor(
    @InjectRepository(Category)
    private readonly categoryRepository: Repository<Category>,
    @Inject(CACHE_MANAGER) private readonly cacheManager: Cache,
  ) {}

  private categoryDetailCacheKey(id: string): string {
    return `/v1/categories/${id}`;
  }

  async create(dto: CreateCategoryDto): Promise<Category> {
    const category = this.categoryRepository.create(dto);
    try {
      const saved = await this.categoryRepository.save(category);
      await this.cacheManager.del(CATEGORIES_LIST_CACHE_KEY);
      return saved;
    } catch (error) {
      if (isUniqueViolation(error)) {
        throw new ConflictException(`Category "${dto.name}" already exists`);
      }
      throw error;
    }
  }

  findAll(): Promise<Category[]> {
    return this.categoryRepository.find({ order: { createdAt: 'ASC' } });
  }

  async findOne(id: string): Promise<Category> {
    const category = await this.categoryRepository.findOne({ where: { id } });
    if (!category) throw new NotFoundException(`Category ${id} not found`);
    return category;
  }

  async update(id: string, dto: UpdateCategoryDto): Promise<Category> {
    const category = await this.findOne(id);
    Object.assign(category, dto);
    try {
      const saved = await this.categoryRepository.save(category);
      await Promise.all([
        this.cacheManager.del(this.categoryDetailCacheKey(id)),
        this.cacheManager.del(CATEGORIES_LIST_CACHE_KEY),
      ]);
      return saved;
    } catch (error) {
      if (isUniqueViolation(error)) {
        throw new ConflictException(
          `Category "${category.name}" already exists`,
        );
      }
      throw error;
    }
  }

  async remove(id: string): Promise<void> {
    const category = await this.findOne(id);
    await this.categoryRepository.remove(category);
    await Promise.all([
      this.cacheManager.del(this.categoryDetailCacheKey(id)),
      this.cacheManager.del(CATEGORIES_LIST_CACHE_KEY),
    ]);
  }
}
