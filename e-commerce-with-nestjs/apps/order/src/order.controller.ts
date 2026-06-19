import {
  Body,
  Controller,
  Get,
  Param,
  ParseIntPipe,
  ParseUUIDPipe,
  Post,
  Query,
  UseGuards,
} from '@nestjs/common';
import { EventPattern } from '@nestjs/microservices';
import { EVENTS } from '@app/constants';
import { CreateOrderDto } from './dto/create-order.dto';
import { Order } from './entities/order.entity';
import { OrderService } from './order.service';
import { JwtAuthGuard } from '@app/common';

@UseGuards(JwtAuthGuard)
@Controller({ path: 'orders', version: '1' })
export class OrderController {
  constructor(private readonly orderService: OrderService) {}

  @Post()
  create(@Body() dto: CreateOrderDto): Promise<Order> {
    return this.orderService.create(dto);
  }

  @Get()
  findAll(
    @Query('page', new ParseIntPipe({ optional: true })) page?: number,
    @Query('limit', new ParseIntPipe({ optional: true })) limit?: number,
  ): Promise<Order[]> {
    return this.orderService.findAll(page, limit);
  }

  @Get(':id')
  findOne(@Param('id', ParseUUIDPipe) id: string): Promise<Order> {
    return this.orderService.findOne(id);
  }

  @EventPattern(EVENTS.ORDER_PROCESSED)
  handleOrderProcessed(data: {
    orderId: string;
    success: boolean;
    message: string;
  }): Promise<void> {
    return this.orderService.handleOrderProcessed(data);
  }
}
