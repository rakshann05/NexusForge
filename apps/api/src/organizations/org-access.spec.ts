import { ExecutionContext, ForbiddenException, NotFoundException } from '@nestjs/common';
import { OrgAccessGuard, OrgPermission, roleHasPermission } from './org-access';

const contextFor = (request: Record<string, unknown>) =>
  ({
    switchToHttp: () => ({ getRequest: () => request }),
    getHandler: () => 'handler',
    getClass: () => 'class',
  }) as unknown as ExecutionContext;

const reflector = (permissions: OrgPermission[]) => ({ getAllAndOverride: jest.fn().mockReturnValue(permissions) });

describe('roleHasPermission', () => {
  it('grants read to every role and management only to owner/admin', () => {
    expect(roleHasPermission('VIEWER', 'organization:read')).toBe(true);
    expect(roleHasPermission('MEMBER', 'organization:manage_members')).toBe(false);
    expect(roleHasPermission('ADMIN', 'organization:manage_members')).toBe(true);
    expect(roleHasPermission('OWNER', 'organization:update')).toBe(true);
  });
});

describe('OrgAccessGuard', () => {
  it('allows a member who holds the required permission and attaches the membership', async () => {
    const prisma = { organizationMember: { findUnique: jest.fn().mockResolvedValue({ id: 'm1', role: 'ADMIN', userId: 'A', organizationId: 'orgA' }) } };
    const request = { user: { sub: 'A' }, params: { organizationId: 'orgA' } } as Record<string, unknown>;
    const guard = new OrgAccessGuard(reflector(['organization:update']) as never, prisma as never);
    await expect(guard.canActivate(contextFor(request))).resolves.toBe(true);
    expect((request.orgMembership as { role: string }).role).toBe('ADMIN');
  });

  it('rejects a member who lacks the required permission (403)', async () => {
    const prisma = { organizationMember: { findUnique: jest.fn().mockResolvedValue({ id: 'm1', role: 'MEMBER', userId: 'A', organizationId: 'orgA' }) } };
    const guard = new OrgAccessGuard(reflector(['organization:manage_members']) as never, prisma as never);
    await expect(
      guard.canActivate(contextFor({ user: { sub: 'A' }, params: { organizationId: 'orgA' } })),
    ).rejects.toBeInstanceOf(ForbiddenException);
  });

  it('returns 404 for a non-member so other tenants are not disclosed (cross-tenant isolation)', async () => {
    // User A tries to reach Organization B, where A has no membership.
    const prisma = { organizationMember: { findUnique: jest.fn().mockResolvedValue(null) } };
    const guard = new OrgAccessGuard(reflector(['organization:read']) as never, prisma as never);
    await expect(
      guard.canActivate(contextFor({ user: { sub: 'A' }, params: { organizationId: 'orgB' } })),
    ).rejects.toBeInstanceOf(NotFoundException);
  });
});
