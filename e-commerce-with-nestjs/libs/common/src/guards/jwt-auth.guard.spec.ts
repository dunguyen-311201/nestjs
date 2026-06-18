import { type ExecutionContext, UnauthorizedException } from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import { JwtAuthGuard } from './jwt-auth.guard';

const createMockContext = (authorization?: string): ExecutionContext =>
  ({
    switchToHttp: () => ({
      getRequest: () => ({ headers: { authorization }, user: undefined }),
    }),
  }) as unknown as ExecutionContext;

describe('JwtAuthGuard', () => {
  let guard: JwtAuthGuard;
  let jwtService: JwtService;

  beforeEach(() => {
    jwtService = { verifyAsync: jest.fn() } as unknown as JwtService;
    guard = new JwtAuthGuard(jwtService);
  });

  it('should be defined', () => {
    expect(guard).toBeDefined();
  });

  it('should return true and attach payload for a valid token', async () => {
    const payload = { sub: 'uuid-1', username: 'alice' };
    (jwtService.verifyAsync as jest.Mock).mockResolvedValue(payload);

    const ctx = createMockContext('Bearer valid-token');
    const result = await guard.canActivate(ctx);

    expect(result).toBe(true);
    expect(jwtService.verifyAsync).toHaveBeenCalledWith(
      'valid-token',
      expect.any(Object),
    );
  });

  it('should throw UnauthorizedException when Authorization header is missing', async () => {
    await expect(guard.canActivate(createMockContext())).rejects.toThrow(
      UnauthorizedException,
    );
  });

  it('should throw UnauthorizedException when token is not Bearer type', async () => {
    await expect(
      guard.canActivate(createMockContext('Basic abc123')),
    ).rejects.toThrow(UnauthorizedException);
  });

  it('should throw UnauthorizedException when JWT verification fails', async () => {
    (jwtService.verifyAsync as jest.Mock).mockRejectedValue(
      new Error('invalid'),
    );
    await expect(
      guard.canActivate(createMockContext('Bearer bad-token')),
    ).rejects.toThrow(UnauthorizedException);
  });
});
