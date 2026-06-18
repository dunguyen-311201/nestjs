import { Inject, Injectable } from '@nestjs/common';
import { ClientProxy } from '@nestjs/microservices';
import { firstValueFrom } from 'rxjs';
import { EVENTS, MESSAGES } from '@app/constants';
import { Order, OrderProcessPayload } from '@app/shared';

@Injectable()
export class InventoryService {
  constructor(
    @Inject('ORDER_SERVICE') private readonly orderClient: ClientProxy,
    @Inject('PRODUCT_SERVICE') private readonly productClient: ClientProxy,
  ) {}

  async handleOrderCreated(order: Order): Promise<void> {
    const result = await firstValueFrom(
      this.productClient.send<{ success: boolean; message: string }>(
        MESSAGES.RESERVE_STOCK,
        order,
      ),
    );

    const payload: OrderProcessPayload = {
      orderId: order.id,
      success: result.success,
      message: result.message,
    };
    this.orderClient.emit(EVENTS.ORDER_PROCESSED, payload);
  }
}
