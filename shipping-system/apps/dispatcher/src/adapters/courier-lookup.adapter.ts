import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { Courier } from '../entities/courier.entity';
import { ICourierLookupPort } from '../ports/courier-lookup.port';

@Injectable()
export class CourierLookupAdapter implements ICourierLookupPort {
  constructor(
    @InjectRepository(Courier, 'courier')
    private readonly repository: Repository<Courier>,
  ) {}

  async findCourierById(id: string): Promise<Courier | null> {
    return this.repository.findOne({ where: { id } });
  }
}
