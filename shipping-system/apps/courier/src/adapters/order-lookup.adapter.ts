import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import {
  IOrderLookupPort,
  ParcelOrderContext,
} from '../ports/order-lookup.port';
import { Parcel } from '../entities/parcel.entity';
import { ShipmentOrder } from '../entities/shipment-order.entity';

@Injectable()
export class OrderLookupAdapter implements IOrderLookupPort {
  constructor(
    @InjectRepository(Parcel, 'order')
    private readonly parcelRepository: Repository<Parcel>,
    @InjectRepository(ShipmentOrder, 'order')
    private readonly shipmentOrderRepository: Repository<ShipmentOrder>,
  ) {}

  async findParcelOrderContext(
    parcelId: string,
  ): Promise<ParcelOrderContext | null> {
    const parcel = await this.parcelRepository.findOne({
      where: { id: parcelId },
    });
    if (!parcel) {
      return null;
    }

    const order = await this.shipmentOrderRepository.findOne({
      where: { id: parcel.shipmentOrderId },
    });

    return {
      shipmentOrderId: parcel.shipmentOrderId,
      orderStatus: order?.status as string,
      parcelDirection: parcel.direction,
      assignedCourierId: parcel.assignedCourierId,
    };
  }
}
