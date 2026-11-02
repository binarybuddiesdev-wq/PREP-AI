import { ExecutionContext, ForbiddenException } from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { RolesGuard } from './roles.guard.js';

describe('RolesGuard', () => {
  let guard: RolesGuard;
  let reflector: { getAllAndOverride: ReturnType<typeof vi.fn> };
  let request: { user?: { role: string } };
  const context = {
    getHandler: vi.fn(),
    getClass: vi.fn(),
    switchToHttp: () => ({ getRequest: () => request }),
  } as unknown as ExecutionContext;

  beforeEach(() => {
    reflector = { getAllAndOverride: vi.fn() };
    request = {};
    guard = new RolesGuard(reflector as unknown as Reflector);
  });

  it('allows routes without role metadata', () => {
    reflector.getAllAndOverride.mockReturnValue(undefined);
    expect(guard.canActivate(context)).toBe(true);
  });

  it('allows routes with an empty role list', () => {
    reflector.getAllAndOverride.mockReturnValue([]);
    expect(guard.canActivate(context)).toBe(true);
  });

  it('rejects a user missing from a role-protected request', () => {
    reflector.getAllAndOverride.mockReturnValue(['ADMIN']);
    expect(() => guard.canActivate(context)).toThrow(ForbiddenException);
  });

  it('allows an authenticated user with a required role', () => {
    reflector.getAllAndOverride.mockReturnValue(['ADMIN', 'PREMIUM']);
    request.user = { role: 'PREMIUM' };
    expect(guard.canActivate(context)).toBe(true);
  });

  it('rejects an authenticated user without a required role', () => {
    reflector.getAllAndOverride.mockReturnValue(['ADMIN']);
    request.user = { role: 'USER' };
    expect(() => guard.canActivate(context)).toThrow(ForbiddenException);
  });
});
