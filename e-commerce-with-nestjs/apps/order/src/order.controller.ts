import { Body, Controller, Get, Post, Param } from '@nestjs/common';
import { OrderService } from './order.service';
import { CreateOrderInput } from './dto/CreateOrderInput';
import { EventPattern } from '@nestjs/microservices';
import { EVENTS } from '@app/constants';
import type { OrderProcessPayload } from '@app/shared';

@Controller()
export class OrderController {
  constructor(private readonly orderService: OrderService) {}

  @Get()
  getHello(): string {
    return this.orderService.getHello();
  }

  @Get('health')
  healthCheck() {
    return { status: 'ok' };
  }

  @Post('create-order')
  createOrder(@Body() createOrderInput: CreateOrderInput) {
    return this.orderService.createOrder(createOrderInput);
  }

  @Get('orders')
  getOrders() {
    return this.orderService.getOrders();
  }

  @Get('orders/:id')
  getOrderById(@Param('id') id: string) {
    return this.orderService.getOrderById(id);
  }

  @EventPattern(EVENTS.ORDER_PROCESSED)
  handleOrderProcessed(order: OrderProcessPayload) {
    this.orderService.handleOrderProcessed(order);
  }
}
