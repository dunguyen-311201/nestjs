import { Controller } from '@nestjs/common';
import { MessagePattern } from '@nestjs/microservices';
import { MESSAGES } from '@app/constants';
import type { Order } from '@app/shared';
import { ReservationService } from './reservation.service';

@Controller()
export class ReservationController {
  constructor(private readonly reservationService: ReservationService) {}

  @MessagePattern(MESSAGES.RESERVE_STOCK)
  reserveStock(order: Order): Promise<{ success: boolean; message: string }> {
    return this.reservationService.checkAndReserve(order);
  }
}
