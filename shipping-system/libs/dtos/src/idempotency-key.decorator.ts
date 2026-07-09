import {
  BadRequestException,
  createParamDecorator,
  ExecutionContext,
} from '@nestjs/common';

export const IDEMPOTENCY_KEY_HEADER = 'idempotency-key';

/**
 * Extracts the required `Idempotency-Key` header from every mutating POST.
 * Missing header -> 400 Bad Request. Validating the cached-response replay
 * against Redis is service-layer logic, out of scope for this shared
 * decorator.
 */
export const IdempotencyKey = createParamDecorator(
  (_data: unknown, ctx: ExecutionContext): string => {
    const request = ctx.switchToHttp().getRequest<{
      headers: Record<string, string | string[] | undefined>;
    }>();
    const value = request.headers[IDEMPOTENCY_KEY_HEADER];
    if (!value || Array.isArray(value)) {
      throw new BadRequestException(
        `Missing required "${IDEMPOTENCY_KEY_HEADER}" header`,
      );
    }
    return value;
  },
);
