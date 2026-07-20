import { Body, Controller, Headers, Param, Post } from '@nestjs/common';
import { IdempotencyKey } from '@app/dtos';
import {
  CallerContext,
  CourierService,
  DeliverResult,
  PickupResult,
} from './courier.service';
import { PickupDto } from './dto/pickup.dto';
import { DeliverDto } from './dto/deliver.dto';

@Controller('couriers/parcels')
export class CourierController {
  constructor(private readonly courierService: CourierService) {}

  @Post(':id/pickup')
  async pickup(
    @Param('id') parcelId: string,
    @Body() dto: PickupDto,
    @IdempotencyKey() idempotencyKey: string,
    @Headers('x-user-id') userId?: string,
    @Headers('x-user-role') role?: string,
  ): Promise<PickupResult> {
    return this.courierService.pickup(
      parcelId,
      dto,
      idempotencyKey,
      toCaller(userId, role),
    );
  }

  @Post(':id/deliver')
  async deliver(
    @Param('id') parcelId: string,
    @Body() dto: DeliverDto,
    @IdempotencyKey() idempotencyKey: string,
    @Headers('x-user-id') userId?: string,
    @Headers('x-user-role') role?: string,
  ): Promise<DeliverResult> {
    return this.courierService.deliver(
      parcelId,
      dto,
      idempotencyKey,
      toCaller(userId, role),
    );
  }
}

function toCaller(userId?: string, role?: string): CallerContext {
  return { userId: userId ?? null, role: role ?? null };
}
