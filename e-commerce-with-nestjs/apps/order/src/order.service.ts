import {
  ForbiddenException,
  Inject,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { ClientProxy } from '@nestjs/microservices';
import { Repository } from 'typeorm';
import { EVENTS } from '@app/constants';
import type { JwtPayload } from '@app/common';
import { UserRole } from '@app/shared';
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

  async findOne(id: string, user: JwtPayload): Promise<Order> {
    const order = await this.orderRepository.findOne({
      where: { id },
      relations: ['items'],
    });
    if (!order) throw new NotFoundException(`Order ${id} not found`);
    const isStaff =
      user.role === UserRole.ADMIN || user.role === UserRole.MERCHANT;
    if (!isStaff && order.customerId !== user.sub) {
      throw new ForbiddenException('You can only view your own orders');
    }
    return order;
  }

  async updateStatus(id: string, status: OrderStatus): Promise<Order> {
    const order = await this.orderRepository.findOne({ where: { id } });
    if (!order) throw new NotFoundException(`Order ${id} not found`);
    order.status = status;
    return this.orderRepository.save(order);
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
