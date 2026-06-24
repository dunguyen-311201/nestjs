import {
  ForbiddenException,
  Inject,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { CACHE_MANAGER, type Cache } from '@nestjs/cache-manager';
import { InjectRepository } from '@nestjs/typeorm';
import { plainToInstance } from 'class-transformer';
import { FindManyOptions, Repository } from 'typeorm';
import type { JwtPayload } from '@app/common';
import { UserRole } from '@app/shared';
import { CategoriesService } from './categories.service';
import { CreateProductDto } from './dto/create-product.dto';
import { ProductQueryDto } from './dto/product-query.dto';
import { ProductResponseDto } from './dto/product-response.dto';
import { UpdateProductDto } from './dto/update-product.dto';
import { Product } from './entities/product.entity';

const PRODUCTS_LIST_CACHE_KEY = '/v1/products';

@Injectable()
export class ProductsService {
  constructor(
    @InjectRepository(Product)
    private readonly productRepository: Repository<Product>,
    private readonly categoriesService: CategoriesService,
    @Inject(CACHE_MANAGER) private readonly cacheManager: Cache,
  ) {}

  private productDetailCacheKey(id: string): string {
    return `/v1/products/${id}`;
  }

  // CacheInterceptor keys GET /v1/products by full URL, so a filtered/paginated
  // list (e.g. ?page=2) isn't covered by this key — @CacheTTL bounds that staleness.
  private async invalidateListCache(): Promise<void> {
    await this.cacheManager.del(PRODUCTS_LIST_CACHE_KEY);
  }

  private toDto(product: Product): ProductResponseDto {
    return plainToInstance(ProductResponseDto, product, {
      excludeExtraneousValues: true,
    });
  }

  async create(
    dto: CreateProductDto,
    requester: JwtPayload,
  ): Promise<ProductResponseDto> {
    const product = this.productRepository.create({
      name: dto.name,
      description: dto.description ?? null,
      price: dto.price,
      stock: dto.stock ?? 0,
      image: dto.image ?? 'no-image.png',
      specs: dto.specs ?? {},
      ownerId: requester.role === UserRole.MERCHANT ? requester.sub : null,
    });
    if (dto.categoryId) {
      product.category = await this.categoriesService.findOne(dto.categoryId);
    }
    const saved = await this.productRepository.save(product);
    await this.invalidateListCache();
    return this.toDto(saved);
  }

  async findAll(query: ProductQueryDto): Promise<ProductResponseDto[]> {
    const options: FindManyOptions<Product> = {
      relations: ['category'],
      order: { createdAt: 'ASC' },
      skip: ((query.page ?? 1) - 1) * (query.limit ?? 10),
      take: query.limit ?? 10,
    };
    if (query.categoryId) {
      options.where = { category: { id: query.categoryId } };
    }
    return (await this.productRepository.find(options)).map((p) =>
      this.toDto(p),
    );
  }

  async findOne(id: string): Promise<ProductResponseDto> {
    const product = await this.productRepository.findOne({
      where: { id },
      relations: ['category'],
    });
    if (!product) throw new NotFoundException(`Product ${id} not found`);
    return this.toDto(product);
  }

  async update(
    id: string,
    dto: UpdateProductDto,
    requester: JwtPayload,
  ): Promise<ProductResponseDto> {
    const product = await this.productRepository.findOne({
      where: { id },
      relations: ['category'],
    });
    if (!product) throw new NotFoundException(`Product ${id} not found`);
    this.assertCanManage(product, requester);
    const { categoryId, ...rest } = dto;
    Object.assign(product, rest);
    if (categoryId !== undefined) {
      product.category = categoryId
        ? await this.categoriesService.findOne(categoryId)
        : null;
    }
    const saved = await this.productRepository.save(product);
    await Promise.all([
      this.cacheManager.del(this.productDetailCacheKey(id)),
      this.invalidateListCache(),
    ]);
    return this.toDto(saved);
  }

  async remove(id: string, requester: JwtPayload): Promise<void> {
    const product = await this.productRepository.findOne({ where: { id } });
    if (!product) throw new NotFoundException(`Product ${id} not found`);
    this.assertCanManage(product, requester);
    await this.productRepository.remove(product);
    await Promise.all([
      this.cacheManager.del(this.productDetailCacheKey(id)),
      this.invalidateListCache(),
    ]);
  }

  private assertCanManage(product: Product, requester: JwtPayload): void {
    if (requester.role === UserRole.ADMIN) return;
    if (
      requester.role === UserRole.MERCHANT &&
      product.ownerId === requester.sub
    ) {
      return;
    }
    throw new ForbiddenException('You can only manage your own products');
  }
}
