import { IsUUID } from 'class-validator';

export class AssignTripDto {
  @IsUUID()
  driver_id: string;

  @IsUUID()
  truck_id: string;
}
