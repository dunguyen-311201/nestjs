import { Body, Controller, Param, Post } from '@nestjs/common';
import { IdempotencyKey } from '@app/dtos';
import { CourierService, DeliverResult, PickupResult } from './courier.service';
import { PickupDto } from './dto/pickup.dto';
import { DeliverDto } from './dto/deliver.dto';

@Controller('couriers/legs')
export class CourierController {
  constructor(private readonly courierService: CourierService) {}

  @Post(':id/pickup')
  async pickup(
    @Param('id') parcelId: string,
    @Body() dto: PickupDto,
    @IdempotencyKey() idempotencyKey: string,
  ): Promise<PickupResult> {
    return this.courierService.pickup(parcelId, dto, idempotencyKey);
  }

  @Post(':id/deliver')
  async deliver(
    @Param('id') parcelId: string,
    @Body() dto: DeliverDto,
    @IdempotencyKey() idempotencyKey: string,
  ): Promise<DeliverResult> {
    return this.courierService.deliver(parcelId, dto, idempotencyKey);
  }
}
