import { UnprocessableEntityException } from '@nestjs/common';

/**
 * Shared exception for every business-rule guard failure across services
 * (docs/lld/00-conventions.md § Error envelope): 422 with { rule, message }.
 * One class, reused everywhere - never a per-service subclass.
 */
export class BusinessRuleException extends UnprocessableEntityException {
  constructor(
    public readonly rule: string,
    message: string,
  ) {
    super({ rule, message });
  }
}
