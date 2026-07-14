import { IsUUID } from 'class-validator';

export class CreateTripDto {
  @IsUUID()
  origin_hub_id: string;

  @IsUUID()
  dest_hub_id: string;
}
