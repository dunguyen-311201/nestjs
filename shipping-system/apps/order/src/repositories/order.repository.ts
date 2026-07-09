import { Injectable } from '@nestjs/common';
import { InjectDataSource } from '@nestjs/typeorm';
import { DataSource } from 'typeorm';
import { Customer } from '../entities/customer.entity';
import { ShipmentOrder } from '../entities/shipment-order.entity';
import { Parcel } from '../entities/parcel.entity';
import { ShipmentOrderStatus } from '../entities/shipment-order-status.enum';
import { IOrderRepository, NewOrderData } from '../ports/order-repository.port';

@Injectable()
export class OrderRepository implements IOrderRepository {
  constructor(@InjectDataSource() private readonly dataSource: DataSource) {}

  async createOrder(data: NewOrderData): Promise<ShipmentOrder> {
    return this.dataSource.transaction(async (manager) => {
      const sender = await manager.save(Customer, data.sender);
      const recipient = await manager.save(Customer, data.recipient);

      const order = await manager.save(ShipmentOrder, {
        senderId: sender.id,
        recipientId: recipient.id,
        rateCardId: data.rateCardId,
        priceCents: data.priceCents,
        expectedDeliveryAt: data.expectedDeliveryAt,
        status: ShipmentOrderStatus.CREATED,
      });

      const parcels = await manager.save(
        Parcel,
        data.parcels.map((parcel) => ({
          shipmentOrderId: order.id,
          declaredWeightGrams: parcel.declaredWeightGrams,
          type: parcel.type,
          direction: parcel.direction,
          state: parcel.state,
        })),
      );

      order.sender = sender;
      order.recipient = recipient;
      order.parcels = parcels;
      return order;
    });
  }

  async findById(id: string): Promise<ShipmentOrder | null> {
    return this.dataSource.getRepository(ShipmentOrder).findOne({
      where: { id },
      relations: ['parcels'],
    });
  }
}
