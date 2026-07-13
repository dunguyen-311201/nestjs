import { Payment } from '../entities/payment.entity';

export interface ConfirmPaymentData {
  shipmentOrderId: string;
  provider: string;
  externalTransactionId: string;
  externalReferenceId: string | null;
  status: string;
}

export type ConfirmPaymentResult = 'confirmed' | 'duplicate';

export abstract class IPaymentRepository {
  abstract findByShipmentOrderId(
    shipmentOrderId: string,
  ): Promise<Payment | null>;

  // Idempotent on external_transaction_id (webhook redelivery): a repeat
  // event is a no-op ('duplicate'), never a second PAYMENT/SHIPMENT_ORDER
  // write.
  abstract confirmPayment(
    data: ConfirmPaymentData,
  ): Promise<ConfirmPaymentResult>;
}
