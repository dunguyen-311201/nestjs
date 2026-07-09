import {
  Body,
  Controller,
  Get,
  NotFoundException,
  Post,
  Query,
} from '@nestjs/common';
import { IdempotencyKey } from '@app/dtos';
import { OrderService, CreateOrderResult } from './order.service';
import { CreateOrderDto } from './dto/create-order.dto';
import { ParcelType } from './entities/parcel.enums';
import { IPricingPort } from './ports/pricing.port';

export interface QuoteResult {
  price_cents: number;
  sla_expected_delivery: Date;
}

@Controller('orders')
export class OrderController {
  constructor(
    private readonly orderService: OrderService,
    private readonly pricingPort: IPricingPort,
  ) {}

  @Post()
  async create(
    @Body() dto: CreateOrderDto,
    @IdempotencyKey() idempotencyKey: string,
  ): Promise<CreateOrderResult> {
    return this.orderService.createOrder(dto, idempotencyKey);
  }

  @Get(':id/quote')
  async quote(
    @Query('origin_zone_id') originZoneId: string,
    @Query('dest_zone_id') destZoneId: string,
    @Query('parcel_type') parcelType: ParcelType,
  ): Promise<QuoteResult> {
    const quote = await this.pricingPort.getPrice(
      originZoneId,
      destZoneId,
      parcelType,
    );
    if (!quote) {
      throw new NotFoundException(
        'No matching rate card for this route/parcel type',
      );
    }
    return {
      price_cents: quote.priceCents,
      sla_expected_delivery: quote.slaExpectedDelivery,
    };
  }
}
