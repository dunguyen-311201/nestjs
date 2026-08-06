import {
  IsBoolean,
  IsInt,
  IsOptional,
  IsPositive,
  IsUUID,
} from 'class-validator';

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

  // Hub staff visually inspects the parcel during a scan and reports it
  // damaged instead of recording a normal receive/arrival - the only
  // trigger for PARCEL.state = Damaged in this slice.
  @IsOptional()
  @IsBoolean()
  damaged?: boolean;
}
