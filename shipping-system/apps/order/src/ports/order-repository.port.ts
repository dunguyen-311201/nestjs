import { Customer } from '../entities/customer.entity';
import { ShipmentOrder } from '../entities/shipment-order.entity';
import { Parcel } from '../entities/parcel.entity';
import { ParcelState } from '../entities/parcel.enums';
import { ShipmentOrderStatus } from '../entities/shipment-order-status.enum';
import { PaymentType } from '../entities/payment.entity';

export interface NewOrderData {
  sender: Pick<
    Customer,
    'nameEnc' | 'phoneEnc' | 'phoneHash' | 'addressEnc' | 'regionCode'
  >;
  recipient: Pick<
    Customer,
    'nameEnc' | 'phoneEnc' | 'phoneHash' | 'addressEnc' | 'regionCode'
  >;
  rateCardId: string;
  routeId: string;
  priceCents: number;
  expectedDeliveryAt: Date;
  paymentType: PaymentType;
  parcels: Pick<
    Parcel,
    'declaredWeightGrams' | 'type' | 'direction' | 'state'
  >[];
}

export interface ParcelWeightAndRouteUpdate {
  actualWeightGrams?: number;
  routeId?: string;
}

export abstract class IOrderRepository {
  abstract createOrder(data: NewOrderData): Promise<ShipmentOrder>;
  abstract findById(id: string): Promise<ShipmentOrder | null>;
  abstract findParcelById(parcelId: string): Promise<Parcel | null>;
  abstract updateParcelState(
    parcelId: string,
    state: ParcelState,
  ): Promise<void>;
  // Applied by ParcelEventConsumer on parcel.hub_received (BR-06 weight
  // capture, and BR-02's corrective route_id on a misrouted-then-corrected
  // scan) - Hub Service never writes PARCEL directly, only Order does.
  abstract updateParcelWeightAndRoute(
    parcelId: string,
    update: ParcelWeightAndRouteUpdate,
  ): Promise<void>;
  abstract findParcelStatesByShipmentOrderId(
    shipmentOrderId: string,
  ): Promise<ParcelState[] | null>;
  abstract updateShipmentOrderStatus(
    shipmentOrderId: string,
    status: ShipmentOrderStatus,
  ): Promise<void>;
}
