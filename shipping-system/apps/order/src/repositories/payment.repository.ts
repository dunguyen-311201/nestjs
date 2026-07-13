import { Injectable } from '@nestjs/common';
import { InjectDataSource } from '@nestjs/typeorm';
import { DataSource } from 'typeorm';
import { Payment } from '../entities/payment.entity';
import { PaymentTransaction } from '../entities/payment-transaction.entity';
import { PaymentStatus } from '../entities/payment-status.enum';
import { ShipmentOrder } from '../entities/shipment-order.entity';
import { ShipmentOrderStatus } from '../entities/shipment-order-status.enum';
import {
  ConfirmPaymentData,
  ConfirmPaymentResult,
  IPaymentRepository,
} from '../ports/payment-repository.port';

@Injectable()
export class PaymentRepository implements IPaymentRepository {
  constructor(@InjectDataSource() private readonly dataSource: DataSource) {}

  findByShipmentOrderId(shipmentOrderId: string): Promise<Payment | null> {
    return this.dataSource
      .getRepository(Payment)
      .findOne({ where: { shipmentOrderId } });
  }

  async confirmPayment(
    data: ConfirmPaymentData,
  ): Promise<ConfirmPaymentResult> {
    return this.dataSource.transaction(async (manager) => {
      const payment = await manager
        .getRepository(Payment)
        .findOne({ where: { shipmentOrderId: data.shipmentOrderId } });
      if (!payment) {
        throw new Error(
          `No PAYMENT row for shipment_order_id ${data.shipmentOrderId}`,
        );
      }

      // Webhook idempotency (2nd layer, per CLAUDE.md): a redelivered
      // Stripe event is a no-op - orIgnore() on external_transaction_id's
      // UNIQUE constraint means a duplicate never reaches the PAYMENT/
      // SHIPMENT_ORDER writes below.
      const inserted = await manager
        .createQueryBuilder()
        .insert()
        .into(PaymentTransaction)
        .values({
          paymentId: payment.id,
          provider: data.provider,
          externalTransactionId: data.externalTransactionId,
          externalReferenceId: data.externalReferenceId,
          status: data.status,
        })
        .orIgnore()
        .execute();

      if (inserted.identifiers.length === 0) {
        return 'duplicate';
      }

      await manager
        .getRepository(Payment)
        .update(payment.id, { status: PaymentStatus.PAID });
      await manager.getRepository(ShipmentOrder).update(data.shipmentOrderId, {
        status: ShipmentOrderStatus.CONFIRMED,
      });

      return 'confirmed';
    });
  }
}
