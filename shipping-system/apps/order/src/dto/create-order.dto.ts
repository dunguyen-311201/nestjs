import { Type } from 'class-transformer';
import {
  ArrayMinSize,
  IsDefined,
  IsEnum,
  IsInt,
  IsNotEmpty,
  IsString,
  Min,
  ValidateNested,
} from 'class-validator';
import { ParcelType } from '../entities/parcel.enums';

export enum PaymentType {
  PREPAID_STRIPE = 'PREPAID_STRIPE',
}

export class AddressDto {
  @IsString()
  @IsNotEmpty()
  name: string;

  @IsString()
  @IsNotEmpty()
  phone: string;

  @IsString()
  @IsNotEmpty()
  address: string;

  @IsString()
  @IsNotEmpty()
  region_code: string;
}

export class OrderParcelDto {
  @IsInt()
  @Min(1)
  declared_weight_grams: number;

  @IsEnum(ParcelType)
  type: ParcelType;
}

export class CreateOrderDto {
  @IsDefined()
  @ValidateNested()
  @Type(() => AddressDto)
  sender: AddressDto;

  @IsDefined()
  @ValidateNested()
  @Type(() => AddressDto)
  recipient: AddressDto;

  @ValidateNested({ each: true })
  @Type(() => OrderParcelDto)
  @ArrayMinSize(1)
  parcels: OrderParcelDto[];

  @IsEnum(PaymentType)
  payment_type: PaymentType;
}
