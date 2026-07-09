import { UnprocessableEntityException } from '@nestjs/common';

/**
 * Shared exception for every business-rule guard failure across services:
 * 422 Unprocessable Entity with { rule, message }. One class, reused
 * everywhere - never a per-service subclass.
 */
export class BusinessRuleException extends UnprocessableEntityException {
  constructor(
    public readonly rule: string,
    message: string,
  ) {
    super({ rule, message });
  }
}
