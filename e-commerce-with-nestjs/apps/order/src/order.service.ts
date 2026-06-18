import { Inject, Injectable, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { ClientProxy } from '@nestjs/microservices';
import { Repository } from 'typeorm';
import { EVENTS } from '@app/constants';
import { CreateOrderDto } from './dto/create-order.dto';
import { Order, OrderStatus } from './entities/order.entity';

@Injectable()
export class OrderService {
  constructor(
    @InjectRepository(Order)
    private readonly orderRepository: Repository<Order>,
    @Inject('INVENTORY_SERVICE')
    private readonly inventoryClient: ClientProxy,
  ) {}

  async create(dto: CreateOrderDto): Promise<Order> {
    const totalPrice = dto.items.reduce(
      (sum, item) => sum + item.quantity * Number(item.unitPrice),
      0,
    );

    const order = this.orderRepository.create({
      customerId: dto.customerId,
      totalPrice,
      status: OrderStatus.PENDING,
      items: dto.items.map((item) => ({
        productId: item.productId,
        quantity: item.quantity,
        unitPrice: item.unitPrice,
      })),
    });

    const saved = await this.orderRepository.save(order);
    this.inventoryClient.emit(EVENTS.ORDER_CREATED, saved);
    return saved;
  }

  async findAll(page = 1, limit = 10): Promise<Order[]> {
    return this.orderRepository.find({
      relations: ['items'],
      order: { createdAt: 'DESC' },
      skip: (page - 1) * limit,
      take: limit,
    });
  }

  async findOne(id: string): Promise<Order> {
    const order = await this.orderRepository.findOne({
      where: { id },
      relations: ['items'],
    });
    if (!order) throw new NotFoundException(`Order ${id} not found`);
    return order;
  }

  async handleOrderProcessed(data: {
    orderId: string;
    success: boolean;
    message: string;
  }): Promise<void> {
    const order = await this.orderRepository.findOne({
      where: { id: data.orderId },
    });
    if (!order) return;
    order.status = data.success ? OrderStatus.APPROVED : OrderStatus.DECLINED;
    await this.orderRepository.save(order);
  }
}
