import { Controller, Get } from '@nestjs/common';
import { EventPattern } from '@nestjs/microservices';
import { EVENTS } from '@app/constants';
import type { Order } from '@app/shared';
import { InventoryService } from './inventory.service';

@Controller()
export class InventoryController {
  constructor(private readonly inventoryService: InventoryService) {}

  @Get('health')
  healthCheck() {
    return { status: 'ok' };
  }

  @EventPattern(EVENTS.ORDER_CREATED)
  handleOrderCreated(order: Order): Promise<void> {
    return this.inventoryService.handleOrderCreated(order);
  }
}
