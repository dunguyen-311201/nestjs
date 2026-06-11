import { Controller, Get } from '@nestjs/common';
import { InventoryService } from './inventory.service';
import { EventPattern } from '@nestjs/microservices';
import { EVENTS } from '@app/constants';
import type { Order } from '@app/shared';

@Controller()
export class InventoryController {
  constructor(private readonly inventoryService: InventoryService) {}

  @Get()
  getHello(): string {
    return this.inventoryService.getHello();
  }

  @EventPattern(EVENTS.ORDER_CREATED)
  handleOrderCreated(order: Order) {
    this.inventoryService.handleOrderCreated(order);
  }
}
