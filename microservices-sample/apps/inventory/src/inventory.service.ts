import { Inject, Injectable } from '@nestjs/common';
import { ClientProxy } from '@nestjs/microservices';
import { EVENTS } from '@app/constants';
import { Inventory, Order, OrderProcessPayload } from '@app/shared';

@Injectable()
export class InventoryService {
  constructor(@Inject('ORDER_SERVICE') private orderClient: ClientProxy) {}

  private inventory: Inventory[] = [
    {
      id: '1',
      name: 'Product 1',
      quantity: 100,
    },
    {
      id: '2',
      name: 'Product 2',
      quantity: 200,
    },
    {
      id: '3',
      name: 'Product 3',
      quantity: 300,
    },
  ];

  handleOrderCreated(order: Order) {
    let success = false;
    let message = '';
    const item = this.inventory.find((item) => item.name === order.product);

    if (item) {
      if (item.quantity < order.quantity) {
        message = 'Insufficient quantity in inventory';
      } else {
        item.quantity -= order.quantity;
        success = true;
        message = 'Order processed successfully';
      }
    } else {
      message = `Product ${order.product} not found in inventory`;
    }

    const payload: OrderProcessPayload = {
      orderId: order.id,
      success,
      message,
    };

    console.log('Order processed with the payload: ', payload);

    this.orderClient.emit(EVENTS.ORDER_PROCESSED, payload);
  }

  getHello(): string {
    return 'Hello World!';
  }
}
