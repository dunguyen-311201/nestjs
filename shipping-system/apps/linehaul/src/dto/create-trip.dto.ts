import { IsArray, IsOptional, IsUUID } from 'class-validator';

export class CreateTripDto {
  @IsUUID()
  origin_hub_id: string;

  @IsUUID()
  dest_hub_id: string;

  // Which parcels this trip carries (task 7.3) - /depart uses this to
  // publish parcel.loaded_for_linehaul per parcel. Optional: a trip can be
  // created before parcels are assigned to it.
  @IsOptional()
  @IsArray()
  @IsUUID('4', { each: true })
  parcel_ids?: string[];
}
