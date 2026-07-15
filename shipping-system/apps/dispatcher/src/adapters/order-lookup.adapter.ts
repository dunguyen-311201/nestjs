import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { Parcel } from '../entities/parcel.entity';
import { IOrderLookupPort } from '../ports/order-lookup.port';

@Injectable()
export class OrderLookupAdapter implements IOrderLookupPort {
  constructor(
    @InjectRepository(Parcel, 'order')
    private readonly repository: Repository<Parcel>,
  ) {}

  async findParcelById(id: string): Promise<Parcel | null> {
    return this.repository.findOne({ where: { id } });
  }
}
