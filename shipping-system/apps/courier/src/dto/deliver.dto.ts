import {
  IsEnum,
  IsNotEmpty,
  IsOptional,
  IsString,
  IsUUID,
  ValidateIf,
} from 'class-validator';

export enum DeliveryOutcome {
  DELIVERED = 'DELIVERED',
  FAILED = 'FAILED',
}

export class DeliverDto {
  @IsUUID()
  @IsNotEmpty()
  courier_id: string;

  @IsEnum(DeliveryOutcome)
  outcome: DeliveryOutcome;

  @ValidateIf((dto: DeliverDto) => dto.outcome === DeliveryOutcome.DELIVERED)
  @IsString()
  @IsNotEmpty()
  signature_url?: string;

  @IsOptional()
  @IsString()
  photo_url?: string;

  @ValidateIf((dto: DeliverDto) => dto.outcome === DeliveryOutcome.FAILED)
  @IsString()
  @IsNotEmpty()
  failure_reason?: string;
}
