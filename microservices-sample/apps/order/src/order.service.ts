import { Inject, Injectable } from '@nestjs/common';
import { ClientProxy } from '@nestjs/microservices';
import { CreateOrderInput } from './dto/CreateOrderInput';
import { Order, OrderProcessPayload, OrderStatus } from '@app/shared';

@Injectable()
export class OrderService {
  getHello(): string {
    return 'Hello World!';
  }

  constructor(
    @Inject('INVENTORY_SERVICE') private readonly inventoryClient: ClientProxy,
  ) {}

  private orders: Order[] = [];

  createOrder(createOrderInput: CreateOrderInput): Order {
    const order: Order = {
      ...createOrderInput,
      id: `${this.orders.length + 1}`,
      status: OrderStatus.PENDING,
    };
    this.orders.push(order);
    this.inventoryClient.emit('order_created', order);
    return order;
  }

  getOrders(): Order[] {
    return this.orders;
  }

  handleOrderProcessed(data: OrderProcessPayload) {
    const order = this.orders.find((order) => order.id === data.orderId);
    if (order) {
      order.status = data.success
        ? OrderStatus.COMPLETED
        : OrderStatus.CANCELLED;
      console.log('Order status updated: ', order, this.orders);
    } else {
      console.log('Order not found: ');
    }
  }
}
