import { UnauthorizedException } from '@nestjs/common';
import { hashRefreshToken } from '../common/tokens';
import { AuthService } from './auth.service';

describe('AuthService', () => {
  it('does not reveal whether a user account exists on failed login', async () => {
    const prisma = { user: { findFirst: jest.fn().mockResolvedValue(null) } };
    const service = new AuthService(prisma as never, {} as never, {} as never);
    await expect(service.login('missing@example.com', 'wrong-password', {}))
      .rejects.toBeInstanceOf(UnauthorizedException);
  });
});

describe('AuthService.refresh', () => {
  const token = 'valid.refresh.token';
  const sessionUser = { id: 'user-1', email: 'a@b.c', username: 'ab', displayName: 'AB', roles: [] };

  const buildStored = (overrides: Record<string, unknown> = {}) => ({
    id: 'rt-1',
    tokenHash: hashRefreshToken(token),
    revokedAt: null,
    expiresAt: new Date(Date.now() + 60_000),
    userId: 'user-1',
    sessionId: 'session-1',
    session: { id: 'session-1', revokedAt: null, user: sessionUser },
    ...overrides,
  });

  const makeService = (stored: unknown) => {
    const audit = { record: jest.fn().mockResolvedValue(undefined) };
    const prisma = {
      refreshToken: { findUnique: jest.fn().mockResolvedValue(stored), updateMany: jest.fn().mockResolvedValue({ count: 1 }) },
      session: { update: jest.fn().mockResolvedValue({}) },
      $transaction: jest.fn().mockResolvedValue([]),
    };
    const jwt = { verifyAsync: jest.fn().mockResolvedValue({ sub: 'user-1', sid: 'session-1' }) };
    const service = new AuthService(prisma as never, jwt as never, audit as never);
    return { service, prisma, jwt, audit };
  };

  it('rotates tokens when a current, valid refresh token is presented', async () => {
    const { service, audit } = makeService(buildStored());
    const issue = jest.spyOn(service as never, 'issueTokens').mockResolvedValue({ accessToken: 'new' } as never);
    const result = await service.refresh(token, {});
    expect(issue).toHaveBeenCalledTimes(1);
    expect(result).toEqual({ accessToken: 'new' });
    expect(audit.record).toHaveBeenCalledWith(expect.objectContaining({ action: 'identity.refresh_rotated' }));
  });

  it('detects reuse of a rotated token and terminates the session family', async () => {
    // Stored hash is for the *current* token; an attacker replays an old one.
    const { service, prisma, audit } = makeService(buildStored({ tokenHash: hashRefreshToken('some.other.current.token') }));
    const issue = jest.spyOn(service as never, 'issueTokens');
    await expect(service.refresh(token, {})).rejects.toBeInstanceOf(UnauthorizedException);
    expect(issue).not.toHaveBeenCalled();
    expect(prisma.$transaction).toHaveBeenCalledTimes(1); // terminateSession ran
    expect(prisma.session.update).toHaveBeenCalledWith(expect.objectContaining({ where: { id: 'session-1' } }));
    expect(audit.record).toHaveBeenCalledWith(expect.objectContaining({ action: 'identity.refresh_reuse_detected' }));
  });

  it('rejects a token for an already-revoked session without re-terminating it', async () => {
    const { service, prisma, audit } = makeService(buildStored({ session: { id: 'session-1', revokedAt: new Date(), user: sessionUser } }));
    await expect(service.refresh(token, {})).rejects.toBeInstanceOf(UnauthorizedException);
    expect(prisma.$transaction).not.toHaveBeenCalled();
    expect(audit.record).not.toHaveBeenCalledWith(expect.objectContaining({ action: 'identity.refresh_reuse_detected' }));
  });

  it('rejects an expired refresh token', async () => {
    const { service } = makeService(buildStored({ expiresAt: new Date(Date.now() - 1000) }));
    await expect(service.refresh(token, {})).rejects.toBeInstanceOf(UnauthorizedException);
  });

  it('rejects when no stored token exists for the session', async () => {
    const { service } = makeService(null);
    await expect(service.refresh(token, {})).rejects.toBeInstanceOf(UnauthorizedException);
  });
});
