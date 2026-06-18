import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { Order } from '@app/shared';
import { Product } from './entities/product.entity';
import { Reservation, ReservationStatus } from './entities/reservation.entity';

@Injectable()
export class ReservationService {
  constructor(
    @InjectRepository(Product)
    private readonly productRepository: Repository<Product>,
    @InjectRepository(Reservation)
    private readonly reservationRepository: Repository<Reservation>,
  ) {}

  async checkAndReserve(
    order: Order,
  ): Promise<{ success: boolean; message: string }> {
    const products = await Promise.all(
      order.items.map((item) =>
        this.productRepository.findOne({ where: { id: item.productId } }),
      ),
    );

    for (let i = 0; i < order.items.length; i++) {
      const product = products[i];
      const { productId, quantity } = order.items[i];

      if (!product) {
        return { success: false, message: `Product ${productId} not found` };
      }

      const pending =
        (await this.reservationRepository.sum('quantity', {
          productId,
          status: ReservationStatus.PENDING,
        })) ?? 0;

      if (product.stock - pending < quantity) {
        return {
          success: false,
          message: `Insufficient stock for product ${productId}`,
        };
      }
    }

    await Promise.all(
      order.items.map((item) =>
        this.reservationRepository.save(
          this.reservationRepository.create({
            orderId: order.id,
            productId: item.productId,
            quantity: item.quantity,
            status: ReservationStatus.PENDING,
          }),
        ),
      ),
    );

    return { success: true, message: 'Order processed successfully' };
  }
}
