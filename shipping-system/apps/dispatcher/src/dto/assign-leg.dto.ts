import { IsUUID } from 'class-validator';

export class AssignLegDto {
  @IsUUID()
  courier_id: string;
}
