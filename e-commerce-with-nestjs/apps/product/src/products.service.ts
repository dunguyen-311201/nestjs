import { Injectable, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { plainToInstance } from 'class-transformer';
import { FindManyOptions, Repository } from 'typeorm';
import { CategoriesService } from './categories.service';
import { CreateProductDto } from './dto/create-product.dto';
import { ProductQueryDto } from './dto/product-query.dto';
import { ProductResponseDto } from './dto/product-response.dto';
import { UpdateProductDto } from './dto/update-product.dto';
import { Product } from './entities/product.entity';

@Injectable()
export class ProductsService {
  constructor(
    @InjectRepository(Product)
    private readonly productRepository: Repository<Product>,
    private readonly categoriesService: CategoriesService,
  ) {}

  private toDto(product: Product): ProductResponseDto {
    return plainToInstance(ProductResponseDto, product, {
      excludeExtraneousValues: true,
    });
  }

  async create(dto: CreateProductDto): Promise<ProductResponseDto> {
    const product = this.productRepository.create({
      name: dto.name,
      description: dto.description ?? null,
      price: dto.price,
      stock: dto.stock ?? 0,
      image: dto.image ?? 'no-image.png',
      specs: dto.specs ?? {},
    });
    if (dto.categoryId) {
      product.category = await this.categoriesService.findOne(dto.categoryId);
    }
    return this.toDto(await this.productRepository.save(product));
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

  async update(id: string, dto: UpdateProductDto): Promise<ProductResponseDto> {
    const product = await this.productRepository.findOne({
      where: { id },
      relations: ['category'],
    });
    if (!product) throw new NotFoundException(`Product ${id} not found`);
    const { categoryId, ...rest } = dto;
    Object.assign(product, rest);
    if (categoryId !== undefined) {
      product.category = categoryId
        ? await this.categoriesService.findOne(categoryId)
        : null;
    }
    return this.toDto(await this.productRepository.save(product));
  }

  async remove(id: string): Promise<void> {
    const product = await this.productRepository.findOne({ where: { id } });
    if (!product) throw new NotFoundException(`Product ${id} not found`);
    await this.productRepository.remove(product);
  }
}
