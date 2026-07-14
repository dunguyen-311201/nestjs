import { IsInt, IsOptional, IsPositive, IsUUID } from 'class-validator';

export class ReceiveDto {
  @IsUUID()
  parcel_id: string;

  @IsOptional()
  @IsInt()
  @IsPositive()
  actual_weight_grams?: number;

  @IsOptional()
  @IsUUID()
  linehaul_trip_id?: string;
}
