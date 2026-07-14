import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { Outbox, OutboxStatus } from '../entities/outbox.entity';
import { IOutboxRepository } from '../ports/outbox-repository.port';

@Injectable()
export class OutboxRepository implements IOutboxRepository {
  constructor(
    @InjectRepository(Outbox) private readonly repository: Repository<Outbox>,
  ) {}

  findPendingBatch(limit: number): Promise<Outbox[]> {
    return this.repository.find({
      where: { status: OutboxStatus.PENDING },
      order: { createdAt: 'ASC' },
      take: limit,
    });
  }

  async markPublished(id: string): Promise<void> {
    await this.repository.update(id, {
      status: OutboxStatus.PUBLISHED,
      publishedAt: new Date(),
    });
  }
}
