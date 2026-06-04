import {
  ConflictException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';

import { CreateCategoryDto } from './dto/create-category.dto';
import { UpdateCategoryDto } from './dto/update-category.dto';
import { Category } from './entities/category.entity';

@Injectable()
export class CategoriesService {
  constructor(
    @InjectRepository(Category)
    private readonly categoriesRepository: Repository<Category>,
  ) {}

  async create(dto: CreateCategoryDto): Promise<Category> {
    const existing = await this.categoriesRepository.findOneBy({
      name: dto.name,
    });
    if (existing)
      throw new ConflictException(`Category "${dto.name}" already exists`);

    const category = this.categoriesRepository.create(dto);
    return this.categoriesRepository.save(category);
  }

  findAll(): Promise<Category[]> {
    return this.categoriesRepository.find({ order: { name: 'ASC' } });
  }

  async findOne(id: string): Promise<Category> {
    const category = await this.categoriesRepository.findOneBy({ id });
    if (!category) throw new NotFoundException('Category not found');
    return category;
  }

  async update(id: string, dto: UpdateCategoryDto): Promise<Category> {
    const category = await this.findOne(id);

    if (dto.name && dto.name !== category.name) {
      const existing = await this.categoriesRepository.findOneBy({
        name: dto.name,
      });
      if (existing)
        throw new ConflictException(`Category "${dto.name}" already exists`);
    }

    this.categoriesRepository.merge(category, dto);
    return this.categoriesRepository.save(category);
  }

  async remove(id: string): Promise<Category> {
    const category = await this.findOne(id);
    return this.categoriesRepository.remove(category);
  }
}
