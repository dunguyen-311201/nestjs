import { Injectable } from '@nestjs/common';
import { InjectDataSource } from '@nestjs/typeorm';
import { DataSource } from 'typeorm';
import { ProofOfDelivery } from '../entities/proof-of-delivery.entity';
import { DeliveryAttempt } from '../entities/delivery-attempt.entity';
import { DeliveryAttemptOutcome } from '../entities/delivery-attempt-outcome.enum';
import { Outbox } from '../entities/outbox.entity';
import { Courier } from '../entities/courier.entity';
import {
  ICourierRepository,
  OutboxEventInput,
  RecordDeliveryFailureResult,
  RecordDeliverySuccessResult,
} from '../ports/courier-repository.port';

@Injectable()
export class CourierRepository implements ICourierRepository {
  constructor(@InjectDataSource() private readonly dataSource: DataSource) {}

  async findCourierIdByUserId(userId: string): Promise<string | null> {
    const courier = await this.dataSource
      .getRepository(Courier)
      .findOne({ where: { userId } });
    return courier?.id ?? null;
  }

  async getLatestAttemptNumber(
    parcelId: string,
    direction: string,
  ): Promise<number> {
    return this.queryLatestAttemptNumber(
      this.dataSource.getRepository(DeliveryAttempt),
      parcelId,
      direction,
    );
  }

  async recordPickup(outboxEvent: OutboxEventInput): Promise<void> {
    await this.dataSource.manager.save(Outbox, outboxEvent);
  }

  async recordDeliverySuccess(
    parcelId: string,
    signatureUrl: string | null,
    photoUrl: string | null,
    outboxEvent: OutboxEventInput,
  ): Promise<RecordDeliverySuccessResult> {
    return this.dataSource.transaction(async (manager) => {
      const inserted = await manager.getRepository(ProofOfDelivery).insert({
        parcelId,
        signatureUrl,
        photoUrl,
      });
      await manager.save(Outbox, outboxEvent);
      return { proofOfDeliveryId: inserted.identifiers[0].id as string };
    });
  }

  async recordDeliveryFailure(
    parcelId: string,
    direction: string,
    failureReason: string,
    failedOutboxEvent: OutboxEventInput,
    rtsOutboxEvent: OutboxEventInput,
  ): Promise<RecordDeliveryFailureResult> {
    return this.dataSource.transaction(async (manager) => {
      const attemptRepo = manager.getRepository(DeliveryAttempt);
      const latest = await this.queryLatestAttemptNumber(
        attemptRepo,
        parcelId,
        direction,
      );
      const attemptNumber = latest + 1;

      const inserted = await attemptRepo.insert({
        parcelId,
        direction,
        attemptNumber,
        outcome: DeliveryAttemptOutcome.FAILED,
        failureReason,
      });

      await manager.save(Outbox, failedOutboxEvent);

      const rtsTriggered = attemptNumber === 3;
      if (rtsTriggered) {
        await manager.save(Outbox, rtsOutboxEvent);
      }

      return {
        deliveryAttemptId: inserted.identifiers[0].id as string,
        attemptNumber,
        rtsTriggered,
      };
    });
  }

  private async queryLatestAttemptNumber(
    repo: ReturnType<DataSource['getRepository']>,
    parcelId: string,
    direction: string,
  ): Promise<number> {
    const row = await repo
      .createQueryBuilder('attempt')
      .select('MAX(attempt.attempt_number)', 'max')
      .where('attempt.parcel_id = :parcelId', { parcelId })
      .andWhere('attempt.direction = :direction', { direction })
      .getRawOne<{ max: string | null }>();
    return row?.max ? Number(row.max) : 0;
  }
}
