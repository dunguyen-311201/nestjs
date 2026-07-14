import { Injectable } from '@nestjs/common';
import { InjectDataSource } from '@nestjs/typeorm';
import { DataSource } from 'typeorm';
import { ProofOfDelivery } from '../entities/proof-of-delivery.entity';
import { DeliveryAttempt } from '../entities/delivery-attempt.entity';
import { DeliveryAttemptOutcome } from '../entities/delivery-attempt-outcome.enum';
import {
  ICourierRepository,
  RecordDeliveryFailureResult,
  RecordDeliverySuccessResult,
} from '../ports/courier-repository.port';

@Injectable()
export class CourierRepository implements ICourierRepository {
  constructor(@InjectDataSource() private readonly dataSource: DataSource) {}

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

  async recordDeliverySuccess(
    parcelId: string,
    signatureUrl: string | null,
    photoUrl: string | null,
  ): Promise<RecordDeliverySuccessResult> {
    return this.dataSource.transaction(async (manager) => {
      const inserted = await manager.getRepository(ProofOfDelivery).insert({
        parcelId,
        signatureUrl,
        photoUrl,
      });
      return { proofOfDeliveryId: inserted.identifiers[0].id as string };
    });
  }

  async recordDeliveryFailure(
    parcelId: string,
    direction: string,
    failureReason: string,
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

      return {
        deliveryAttemptId: inserted.identifiers[0].id as string,
        attemptNumber,
        rtsTriggered: attemptNumber === 3,
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
