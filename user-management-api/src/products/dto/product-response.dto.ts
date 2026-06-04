import { Expose, Transform } from 'class-transformer';

import { Product } from '../entities/product.entity';

export class ProductResponseDto {
  @Expose()
  id!: string;

  @Expose()
  name!: string;

  @Expose()
  description!: string | null;

  @Expose()
  price!: number;

  @Expose()
  stock!: number;

  @Expose()
  @Transform(({ obj }: { obj: Product }) => obj.category?.id ?? null)
  categoryId!: string | null;

  @Expose()
  @Transform(({ obj }: { obj: Product }) => obj.category?.name ?? null)
  categoryName!: string | null;

  @Expose()
  createdAt!: Date;

  @Expose()
  updatedAt!: Date;
}
