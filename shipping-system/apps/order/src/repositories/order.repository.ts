import { randomUUID } from 'crypto';
import { Injectable } from '@nestjs/common';
import { InjectDataSource } from '@nestjs/typeorm';
import { DataSource, EntityManager } from 'typeorm';
import { NATS_SUBJECTS } from '@app/contracts';
import { Customer } from '../entities/customer.entity';
import { ShipmentOrder } from '../entities/shipment-order.entity';
import { Parcel } from '../entities/parcel.entity';
import { Outbox, OutboxStatus } from '../entities/outbox.entity';
import { ShipmentOrderStatus } from '../entities/shipment-order-status.enum';
import { ParcelDirection, ParcelState } from '../entities/parcel.enums';
import { Payment } from '../entities/payment.entity';
import { PaymentStatus } from '../entities/payment-status.enum';
import {
  IOrderRepository,
  NewOrderData,
  ParcelWeightAndRouteUpdate,
} from '../ports/order-repository.port';

@Injectable()
export class OrderRepository implements IOrderRepository {
  constructor(@InjectDataSource() private readonly dataSource: DataSource) {}

  async createOrder(data: NewOrderData): Promise<ShipmentOrder> {
    return this.dataSource.transaction(async (manager) => {
      const sender = await this.findOrCreateCustomer(manager, data.sender);
      const recipient = await this.findOrCreateCustomer(
        manager,
        data.recipient,
      );

      const order = await manager.save(ShipmentOrder, {
        senderId: sender.id,
        recipientId: recipient.id,
        rateCardId: data.rateCardId,
        priceCents: data.priceCents,
        expectedDeliveryAt: data.expectedDeliveryAt,
        status: ShipmentOrderStatus.CREATED,
        createdByUserId: data.createdByUserId,
      });

      const parcels = await manager.save(
        Parcel,
        data.parcels.map((parcel) => ({
          shipmentOrderId: order.id,
          routeId: data.routeId,
          declaredWeightGrams: parcel.declaredWeightGrams,
          type: parcel.type,
          direction: parcel.direction,
          state: parcel.state,
        })),
      );

      order.sender = sender;
      order.recipient = recipient;
      order.parcels = parcels;

      // Transactional Outbox (Order Creation only): the order.created row
      // is written in the same transaction as ORDER/PARCEL, so a background
      // poller can never publish an event for a write that didn't actually
      // commit.
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

      // One PAYMENT row per order (UNIQUE shipment_order_id), Unpaid until
      // the Stripe webhook confirms it.
      await manager.save(Payment, {
        shipmentOrderId: order.id,
        type: data.paymentType,
        amountCents: data.priceCents,
        status: PaymentStatus.UNPAID,
      });

      return order;
    });
  }

  // Repeat customers (same phone_hash) reuse their existing CUSTOMER row
  // instead of getting a new one on every order - phone_enc's random IV
  // makes it unusable for this equality lookup, hence the separate
  // deterministic phone_hash column (see Customer entity / libs/crypto's
  // hashForLookup).
  private async findOrCreateCustomer(
    manager: EntityManager,
    data: NewOrderData['sender'],
  ): Promise<Customer> {
    const existing = await manager.findOne(Customer, {
      where: { phoneHash: data.phoneHash },
    });
    if (existing) {
      return existing;
    }
    return manager.save(Customer, data);
  }

  async findById(id: string): Promise<ShipmentOrder | null> {
    return this.dataSource.getRepository(ShipmentOrder).findOne({
      where: { id },
      relations: ['parcels'],
    });
  }

  async findByCreatedByUserId(userId: string): Promise<ShipmentOrder[]> {
    return this.dataSource.getRepository(ShipmentOrder).find({
      where: { createdByUserId: userId },
      order: { createdAt: 'DESC' },
    });
  }

  async findAll(): Promise<ShipmentOrder[]> {
    return this.dataSource.getRepository(ShipmentOrder).find({
      order: { createdAt: 'DESC' },
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

  async updateParcelStateAndDirection(
    parcelId: string,
    state: ParcelState,
    direction: ParcelDirection,
  ): Promise<void> {
    await this.dataSource
      .getRepository(Parcel)
      .update(parcelId, { state, direction });
  }

  async updateParcelWeightAndRoute(
    parcelId: string,
    update: ParcelWeightAndRouteUpdate,
  ): Promise<void> {
    await this.dataSource.getRepository(Parcel).update(parcelId, update);
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
