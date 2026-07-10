import { randomUUID } from 'crypto';
import { Injectable } from '@nestjs/common';
import { InjectDataSource } from '@nestjs/typeorm';
import { DataSource } from 'typeorm';
import { NATS_SUBJECTS } from '@app/contracts';
import { Customer } from '../entities/customer.entity';
import { ShipmentOrder } from '../entities/shipment-order.entity';
import { Parcel } from '../entities/parcel.entity';
import { Outbox, OutboxStatus } from '../entities/outbox.entity';
import { ShipmentOrderStatus } from '../entities/shipment-order-status.enum';
import { ParcelState } from '../entities/parcel.enums';
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

      // Transactional Outbox (Order Creation only, docs/02-HLD.md § Idempotency
      // and outbox mechanics): the order.created row is written in the same
      // transaction as ORDER/PARCEL, so a background poller can never publish
      // an event for a write that didn't actually commit.
      await manager.save(Outbox, {
        eventId: randomUUID(),
        eventType: NATS_SUBJECTS.ORDER_CREATED,
        status: OutboxStatus.PENDING,
        payload: {
          order_id: order.id,
          sender_id: sender.id,
          recipient_id: recipient.id,
          parcel_ids: parcels.map((parcel) => parcel.id),
        },
      });

      return order;
    });
  }

  async findById(id: string): Promise<ShipmentOrder | null> {
    return this.dataSource.getRepository(ShipmentOrder).findOne({
      where: { id },
      relations: ['parcels'],
    });
  }

  findParcelById(parcelId: string): Promise<Parcel | null> {
    return this.dataSource
      .getRepository(Parcel)
      .findOne({ where: { id: parcelId } });
  }

  async updateParcelState(parcelId: string, state: ParcelState): Promise<void> {
    await this.dataSource.getRepository(Parcel).update(parcelId, { state });
  }

  async findParcelStatesByShipmentOrderId(
    shipmentOrderId: string,
  ): Promise<ParcelState[] | null> {
    const order = await this.dataSource
      .getRepository(ShipmentOrder)
      .findOne({ where: { id: shipmentOrderId } });
    if (!order) {
      return null;
    }
    const parcels = await this.dataSource
      .getRepository(Parcel)
      .find({ where: { shipmentOrderId } });
    return parcels.map((parcel) => parcel.state);
  }

  async updateShipmentOrderStatus(
    shipmentOrderId: string,
    status: ShipmentOrderStatus,
  ): Promise<void> {
    await this.dataSource
      .getRepository(ShipmentOrder)
      .update(shipmentOrderId, { status });
  }
}
