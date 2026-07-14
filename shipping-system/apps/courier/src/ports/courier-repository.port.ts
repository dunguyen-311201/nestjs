export interface RecordDeliverySuccessResult {
  proofOfDeliveryId: string;
}

export interface RecordDeliveryFailureResult {
  deliveryAttemptId: string;
  attemptNumber: number;
  rtsTriggered: boolean;
}

export abstract class ICourierRepository {
  // Highest attempt_number recorded for this parcel within the given
  // direction (BR-04: the counter restarts at 1 for the reverse leg, scoped
  // by DELIVERY_ATTEMPT.direction). 0 when no attempt has been recorded yet
  // for this direction.
  abstract getLatestAttemptNumber(
    parcelId: string,
    direction: string,
  ): Promise<number>;

  abstract recordDeliverySuccess(
    parcelId: string,
    signatureUrl: string | null,
    photoUrl: string | null,
  ): Promise<RecordDeliverySuccessResult>;

  // Inserts the next DELIVERY_ATTEMPT for this direction (attempt_number =
  // latest + 1, 1-3). rtsTriggered is true when this insert is the 3rd
  // consecutive failure for this parcel/direction.
  abstract recordDeliveryFailure(
    parcelId: string,
    direction: string,
    failureReason: string,
  ): Promise<RecordDeliveryFailureResult>;
}
