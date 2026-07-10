import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { ShipmentOrder } from '../entities/shipment-order.entity';
import { Parcel } from '../entities/parcel.entity';
import {
  IOrderLookupPort,
  OrderParcelSummary,
} from '../ports/order-lookup.port';

@Injectable()
export class OrderLookupAdapter implements IOrderLookupPort {
  constructor(
    @InjectRepository(ShipmentOrder, 'order')
    private readonly shipmentOrderRepository: Repository<ShipmentOrder>,
    @InjectRepository(Parcel, 'order')
    private readonly parcelRepository: Repository<Parcel>,
  ) {}

  async findParcelsByShipmentOrderId(
    shipmentOrderId: string,
  ): Promise<OrderParcelSummary[] | null> {
    const order = await this.shipmentOrderRepository.findOne({
      where: { id: shipmentOrderId },
    });
    if (!order) {
      return null;
    }

    const parcels = await this.parcelRepository.find({
      where: { shipmentOrderId },
    });
    return parcels.map((parcel) => ({ id: parcel.id, state: parcel.state }));
  }

  async findShipmentOrderIdByParcelId(
    parcelId: string,
  ): Promise<string | null> {
    const parcel = await this.parcelRepository.findOne({
      where: { id: parcelId },
    });
    return parcel?.shipmentOrderId ?? null;
  }
}
