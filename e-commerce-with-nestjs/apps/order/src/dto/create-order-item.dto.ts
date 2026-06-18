import { IsDecimal, IsInt, IsPositive, IsUUID } from 'class-validator';

export class CreateOrderItemDto {
  @IsUUID()
  productId!: string;

  @IsInt()
  @IsPositive()
  quantity!: number;

  @IsDecimal({ decimal_digits: '2' })
  unitPrice!: number;
}
