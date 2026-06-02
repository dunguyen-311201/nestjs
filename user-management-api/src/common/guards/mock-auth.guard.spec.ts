import { ExecutionContext, UnauthorizedException } from '@nestjs/common';
import { MockAuthGuard } from './mock-auth.guard';

const createMockContext = (authorization?: string): ExecutionContext =>
  ({
    switchToHttp: () => ({
      getRequest: () => ({
        headers: { authorization },
      }),
    }),
  }) as unknown as ExecutionContext;

describe('MockAuthGuard', () => {
  let guard: MockAuthGuard;

  beforeEach(() => {
    guard = new MockAuthGuard();
  });

  it('should be defined', () => {
    expect(guard).toBeDefined();
  });

  it('should return true for valid Bearer mock-token', () => {
    const ctx = createMockContext('Bearer mock-token');
    expect(guard.canActivate(ctx)).toBe(true);
  });

  it('should throw UnauthorizedException for a wrong token', () => {
    const ctx = createMockContext('bad-token');
    expect(() => guard.canActivate(ctx)).toThrow(UnauthorizedException);
  });

  it('should throw UnauthorizedException when header is missing', () => {
    const ctx = createMockContext(undefined);
    expect(() => guard.canActivate(ctx)).toThrow(UnauthorizedException);
  });
});
