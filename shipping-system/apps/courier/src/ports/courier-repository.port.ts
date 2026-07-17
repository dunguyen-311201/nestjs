export interface OutboxEventInput {
  eventId: string;
  eventType: string;
  payload: Record<string, unknown>;
}

export interface RecordDeliverySuccessResult {
  proofOfDeliveryId: string;
}

export interface RecordDeliveryFailureResult {
  deliveryAttemptId: string;
  attemptNumber: number;
  rtsTriggered: boolean;
}

export abstract class ICourierRepository {
  // Resolves which courier a gateway-verified Clerk user operates as
  // (COURIER.user_id link); null when the account is not provisioned.
  abstract findCourierIdByUserId(userId: string): Promise<string | null>;

  // Highest attempt_number recorded for this parcel within the given
  // direction (the counter restarts at 1 for the reverse leg, scoped
  // by DELIVERY_ATTEMPT.direction). 0 when no attempt has been recorded yet
  // for this direction.
  abstract getLatestAttemptNumber(
    parcelId: string,
    direction: string,
  ): Promise<number>;

  // Inserts an OUTBOX row only - pickup has no other business row to write.
  // Same transaction/dedup semantics as every other Outbox write in this
  // codebase: a poller publishes PENDING rows asynchronously.
  abstract recordPickup(outboxEvent: OutboxEventInput): Promise<void>;

  // Inserts PROOF_OF_DELIVERY + the delivered-event OUTBOX row in one
  // transaction.
  abstract recordDeliverySuccess(
    parcelId: string,
    signatureUrl: string | null,
    photoUrl: string | null,
    outboxEvent: OutboxEventInput,
  ): Promise<RecordDeliverySuccessResult>;

  // Inserts the next DELIVERY_ATTEMPT for this direction (attempt_number =
  // latest + 1, 1-3), the delivery_failed-event OUTBOX row, and - only when
  // this insert is the 3rd consecutive failure for this parcel/direction -
  // the rts-event OUTBOX row too, all in one transaction.
  abstract recordDeliveryFailure(
    parcelId: string,
    direction: string,
    failureReason: string,
    failedOutboxEvent: OutboxEventInput,
    rtsOutboxEvent: OutboxEventInput,
  ): Promise<RecordDeliveryFailureResult>;
}
