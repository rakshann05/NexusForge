import { ExecutionContext, UnauthorizedException } from '@nestjs/common';
import { JwtAuthGuard, RolesGuard } from './auth';

const contextFor = (authorization = 'Bearer access-token') => ({
  switchToHttp: () => ({ getRequest: () => ({ headers: { authorization } }) }),
  getHandler: () => 'handler',
  getClass: () => 'class',
}) as unknown as ExecutionContext;

describe('identity guards', () => {
  it('rejects an access token from a revoked session', async () => {
    const jwt = { verifyAsync: jest.fn().mockResolvedValue({ sub: 'user-1', sid: 'session-1' }) };
    const prisma = { session: { findUnique: jest.fn().mockResolvedValue({ userId: 'user-1', revokedAt: new Date(), expiresAt: new Date(Date.now() + 60_000) }) } };
    await expect(new JwtAuthGuard(jwt as never, prisma as never).canActivate(contextFor())).rejects.toBeInstanceOf(UnauthorizedException);
  });

  it('checks current database roles instead of stale token claims', async () => {
    const reflector = { getAllAndOverride: jest.fn().mockReturnValue(['ADMIN']) };
    const prisma = { userRole: { findMany: jest.fn().mockResolvedValue([{ role: { key: 'ADMIN' } }]) } };
    const context = { ...contextFor(), switchToHttp: () => ({ getRequest: () => ({ user: { sub: 'user-1', roles: ['MEMBER'] } }) }) } as unknown as ExecutionContext;
    await expect(new RolesGuard(reflector as never, prisma as never).canActivate(context)).resolves.toBe(true);
  });
});
