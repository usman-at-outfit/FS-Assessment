import { ExecutionContext } from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { Role } from '@prisma/client';
import { RolesGuard } from './roles.guard';
import { ROLES_KEY } from '../decorators/roles.decorator';

// ---------------------------------------------------------------------------
// Helper — build a minimal ExecutionContext with a request user and
// optional metadata returned by Reflector.
// ---------------------------------------------------------------------------

function buildContext(
  user: { role: Role } | null,
  requiredRoles: Role[] | undefined,
): ExecutionContext {
  const mockReflector = {
    getAllAndOverride: jest.fn().mockReturnValue(requiredRoles),
  } as unknown as Reflector;

  const mockContext = {
    getHandler: jest.fn(),
    getClass:   jest.fn(),
    switchToHttp: () => ({
      getRequest: () => ({ user }),
    }),
  } as unknown as ExecutionContext;

  // Bind the reflector instance to the guard under test directly
  // (the guard receives it via DI, but here we construct manually)
  return { mockReflector, mockContext } as unknown as ExecutionContext;
}

// ---------------------------------------------------------------------------
// Because RolesGuard is constructed with Reflector, we build one guard per
// test using the factory below.
// ---------------------------------------------------------------------------

function buildGuard(requiredRoles: Role[] | undefined) {
  const reflector = {
    getAllAndOverride: jest.fn().mockReturnValue(requiredRoles),
  } as unknown as Reflector;

  const guard = new RolesGuard(reflector);

  const ctx = {
    getHandler: jest.fn(),
    getClass:   jest.fn(),
    switchToHttp: jest.fn(),
  } as unknown as ExecutionContext;

  return { guard, reflector, ctx };
}

function buildCtxWithUser(user: { role: Role } | null): ExecutionContext {
  return {
    getHandler: jest.fn(),
    getClass:   jest.fn(),
    switchToHttp: () => ({ getRequest: () => ({ user }) }),
  } as unknown as ExecutionContext;
}

describe('RolesGuard', () => {
  it('allows any authenticated user when no @Roles metadata is set (public by default)', () => {
    const reflector = { getAllAndOverride: jest.fn().mockReturnValue(undefined) } as unknown as Reflector;
    const guard = new RolesGuard(reflector);
    const ctx   = buildCtxWithUser({ role: Role.CUSTOMER });

    expect(guard.canActivate(ctx)).toBe(true);
  });

  it('allows ADMIN when the endpoint requires @Roles(Role.ADMIN)', () => {
    const reflector = { getAllAndOverride: jest.fn().mockReturnValue([Role.ADMIN]) } as unknown as Reflector;
    const guard = new RolesGuard(reflector);
    const ctx   = buildCtxWithUser({ role: Role.ADMIN });

    expect(guard.canActivate(ctx)).toBe(true);
  });

  it('blocks CUSTOMER from an endpoint requiring @Roles(Role.ADMIN)', () => {
    const reflector = { getAllAndOverride: jest.fn().mockReturnValue([Role.ADMIN]) } as unknown as Reflector;
    const guard = new RolesGuard(reflector);
    const ctx   = buildCtxWithUser({ role: Role.CUSTOMER });

    expect(() => guard.canActivate(ctx)).toThrow('Forbidden');
  });

  it('reads metadata from both the handler and the class (correct Reflector key)', () => {
    const reflector = { getAllAndOverride: jest.fn().mockReturnValue([Role.ADMIN]) } as unknown as Reflector;
    const guard = new RolesGuard(reflector);
    const handler = jest.fn();
    const cls     = jest.fn();

    const ctx = {
      getHandler:   () => handler,
      getClass:     () => cls,
      switchToHttp: () => ({ getRequest: () => ({ user: { role: Role.ADMIN } }) }),
    } as unknown as ExecutionContext;

    guard.canActivate(ctx);

    // Guard must pass ROLES_KEY as the metadata key
    expect(reflector.getAllAndOverride).toHaveBeenCalledWith(ROLES_KEY, [handler, cls]);
  });

  it('throws ForbiddenException when req.user is absent (unauthenticated request reaches a role-guarded route)', () => {
    const reflector = { getAllAndOverride: jest.fn().mockReturnValue([Role.ADMIN]) } as unknown as Reflector;
    const guard = new RolesGuard(reflector);
    const ctx   = buildCtxWithUser(null);

    expect(() => guard.canActivate(ctx)).toThrow('Forbidden');
  });
});
