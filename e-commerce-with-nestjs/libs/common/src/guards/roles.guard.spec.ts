import { type ExecutionContext } from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { UserRole } from '@app/shared';
import { RolesGuard } from './roles.guard';

const createMockContext = (role?: UserRole): ExecutionContext =>
  ({
    switchToHttp: () => ({
      getRequest: () => ({ user: role ? { role } : undefined }),
    }),
    getHandler: () => ({}),
    getClass: () => ({}),
  }) as unknown as ExecutionContext;

describe('RolesGuard', () => {
  let guard: RolesGuard;
  let reflector: Reflector;

  beforeEach(() => {
    reflector = { getAllAndOverride: jest.fn() } as unknown as Reflector;
    guard = new RolesGuard(reflector);
  });

  it('should be defined', () => {
    expect(guard).toBeDefined();
  });

  it('should allow access when no roles are required', () => {
    (reflector.getAllAndOverride as jest.Mock).mockReturnValue(undefined);

    expect(guard.canActivate(createMockContext(UserRole.USER))).toBe(true);
  });

  it('should allow access when the user has a required role', () => {
    (reflector.getAllAndOverride as jest.Mock).mockReturnValue([
      UserRole.ADMIN,
    ]);

    expect(guard.canActivate(createMockContext(UserRole.ADMIN))).toBe(true);
  });

  it('should deny access when the user lacks a required role', () => {
    (reflector.getAllAndOverride as jest.Mock).mockReturnValue([
      UserRole.ADMIN,
    ]);

    expect(guard.canActivate(createMockContext(UserRole.USER))).toBe(false);
  });

  it('should deny access when there is no authenticated user', () => {
    (reflector.getAllAndOverride as jest.Mock).mockReturnValue([
      UserRole.ADMIN,
    ]);

    expect(guard.canActivate(createMockContext(undefined))).toBe(false);
  });
});
