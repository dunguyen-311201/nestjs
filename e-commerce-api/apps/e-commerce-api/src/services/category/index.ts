import { FastifyBaseLogger } from 'fastify'

import type { TCategoryRepository } from '#repositories'

import { Category } from '#entities'

import { ICategoryService } from './type'

export class CategoryService implements ICategoryService {
  constructor(
    private categoryRepository: TCategoryRepository,
    private logger: FastifyBaseLogger,
  ) {}

  async getAll(): Promise<Category[]> {
    this.logger.info('Fetching all categories')
    const categories = await this.categoryRepository.find()
    this.logger.info(
      { count: categories.length },
      'Categories fetched successfully',
    )
    return categories
  }

  async create(categoryData: Partial<Category>): Promise<Category> {
    this.logger.info({ data: categoryData }, 'Creating new category')
    const category = await this.categoryRepository.save(categoryData)
    this.logger.info(
      { categoryId: category.id },
      'Category created successfully',
    )
    return category
  }
}
