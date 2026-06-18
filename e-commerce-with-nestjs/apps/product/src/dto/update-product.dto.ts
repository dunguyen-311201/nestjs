import {
  IsInt,
  IsNumber,
  IsObject,
  IsOptional,
  IsPositive,
  IsString,
  IsUUID,
  IsUrl,
  Min,
  Validate,
} from 'class-validator';
import { ProductSpecs } from '../custom-validators/product-specs.validator';

export class UpdateProductDto {
  @IsOptional()
  @IsString()
  name?: string;

  @IsOptional()
  @IsString()
  description?: string;

  @IsOptional()
  @IsNumber()
  @IsPositive()
  price?: number;

  @IsOptional()
  @IsInt()
  @Min(0)
  stock?: number;

  @IsOptional()
  @IsString()
  @IsUrl({ require_protocol: true })
  image?: string;

  @IsOptional()
  @IsObject()
  @Validate(ProductSpecs)
  specs?: Record<string, string>;

  @IsOptional()
  @IsUUID()
  categoryId?: string;
}
