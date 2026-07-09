import { Customer } from '../entities/customer.entity';
import { ShipmentOrder } from '../entities/shipment-order.entity';
import { Parcel } from '../entities/parcel.entity';

export interface NewOrderData {
  sender: Pick<Customer, 'nameEnc' | 'phoneEnc' | 'addressEnc' | 'regionCode'>;
  recipient: Pick<
    Customer,
    'nameEnc' | 'phoneEnc' | 'addressEnc' | 'regionCode'
  >;
  rateCardId: string;
  priceCents: number;
  expectedDeliveryAt: Date;
  parcels: Pick<
    Parcel,
    'declaredWeightGrams' | 'type' | 'direction' | 'state'
  >[];
}

export abstract class IOrderRepository {
  abstract createOrder(data: NewOrderData): Promise<ShipmentOrder>;
  abstract findById(id: string): Promise<ShipmentOrder | null>;
}
