import {
  Body,
  Controller,
  Get,
  Headers,
  NotFoundException,
  Param,
  Post,
  Query,
} from '@nestjs/common';
import { IdempotencyKey } from '@app/dtos';
import { OrderService, CreateOrderResult, OrderSummary } from './order.service';
import { PaymentService, CheckoutResult } from './payment.service';
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
    private readonly paymentService: PaymentService,
  ) {}

  // x-user-id / x-user-role always carry the gateway-verified identity -
  // the gateway strips client-sent values before proxying.
  @Get()
  async list(
    @Headers('x-user-id') userId: string | undefined,
    @Headers('x-user-role') role: string | undefined,
  ): Promise<OrderSummary[]> {
    return this.orderService.listOrders(userId ?? null, role ?? null);
  }

  @Post()
  async create(
    @Body() dto: CreateOrderDto,
    @IdempotencyKey() idempotencyKey: string,
    @Headers('x-user-id') userId?: string,
  ): Promise<CreateOrderResult> {
    return this.orderService.createOrder(dto, idempotencyKey, userId ?? null);
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

  @Post(':id/checkout')
  async checkout(@Param('id') id: string): Promise<CheckoutResult> {
    return this.paymentService.checkout(id);
  }
}
