import {
  Body,
  Controller,
  Get,
  Param,
  ParseIntPipe,
  ParseUUIDPipe,
  Patch,
  Post,
  Query,
  UseGuards,
} from '@nestjs/common';
import { EventPattern } from '@nestjs/microservices';
import { EVENTS } from '@app/constants';
import { CreateOrderDto } from './dto/create-order.dto';
import { UpdateOrderStatusDto } from './dto/update-order-status.dto';
import { Order } from './entities/order.entity';
import { OrderService } from './order.service';
import { CurrentUser, JwtAuthGuard, Roles, RolesGuard } from '@app/common';
import type { JwtPayload } from '@app/common';
import { UserRole } from '@app/shared';

@Controller({ path: 'orders', version: '1' })
export class OrderController {
  constructor(private readonly orderService: OrderService) {}

  @Post()
  @UseGuards(JwtAuthGuard, RolesGuard)
  create(@Body() dto: CreateOrderDto): Promise<Order> {
    return this.orderService.create(dto);
  }

  @Get()
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(UserRole.ADMIN, UserRole.MERCHANT)
  findAll(
    @Query('page', new ParseIntPipe({ optional: true })) page?: number,
    @Query('limit', new ParseIntPipe({ optional: true })) limit?: number,
  ): Promise<Order[]> {
    return this.orderService.findAll(page, limit);
  }

  @Get(':id')
  @UseGuards(JwtAuthGuard, RolesGuard)
  findOne(
    @Param('id', ParseUUIDPipe) id: string,
    @CurrentUser() user: JwtPayload,
  ): Promise<Order> {
    return this.orderService.findOne(id, user);
  }

  @Patch(':id/status')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(UserRole.ADMIN, UserRole.MERCHANT)
  updateStatus(
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: UpdateOrderStatusDto,
  ): Promise<Order> {
    return this.orderService.updateStatus(id, dto.status);
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
