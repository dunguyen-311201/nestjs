import { Category } from '#entities'

export interface ICategoryService {
  getAll(): Promise<Category[]>
  create(category: Partial<Category>): Promise<Category>
}
