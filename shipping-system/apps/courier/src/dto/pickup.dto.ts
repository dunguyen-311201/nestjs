import { IsNotEmpty, IsUUID } from 'class-validator';

export class PickupDto {
  @IsUUID()
  @IsNotEmpty()
  courier_id: string;
}
