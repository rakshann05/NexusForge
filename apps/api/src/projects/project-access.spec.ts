import { ExecutionContext, ForbiddenException, NotFoundException } from '@nestjs/common';
import { ProjectAccessGuard, ProjectPermission } from './project-access';

const project = {
  id: 'p1', name: 'P', description: null, organizationId: 'orgA', archivedAt: null,
  createdAt: new Date(), updatedAt: new Date(), organization: { id: 'orgA', name: 'A' }, _count: { members: 2 },
};

const contextFor = (request: Record<string, unknown>) =>
  ({ switchToHttp: () => ({ getRequest: () => request }), getHandler: () => 'h', getClass: () => 'c' }) as unknown as ExecutionContext;
const reflector = (permissions: ProjectPermission[]) => ({ getAllAndOverride: jest.fn().mockReturnValue(permissions) });

describe('ProjectAccessGuard', () => {
  it('returns 404 when the project does not belong to the org in the route (cross-tenant)', async () => {
    const prisma = { project: { findFirst: jest.fn().mockResolvedValue(null) }, projectMember: { findUnique: jest.fn() } };
    const request = { user: { sub: 'A' }, orgMembership: { role: 'OWNER' }, params: { organizationId: 'orgB', projectId: 'p1' } };
    const guard = new ProjectAccessGuard(reflector(['project:read']) as never, prisma as never);
    await expect(guard.canActivate(contextFor(request))).rejects.toBeInstanceOf(NotFoundException);
    expect(prisma.project.findFirst).toHaveBeenCalledWith(expect.objectContaining({ where: { id: 'p1', organizationId: 'orgB' } }));
  });

  it('lets any org member read a project in their org', async () => {
    const prisma = { project: { findFirst: jest.fn().mockResolvedValue(project) }, projectMember: { findUnique: jest.fn().mockResolvedValue(null) } };
    const request = { user: { sub: 'A' }, orgMembership: { role: 'MEMBER' }, params: { organizationId: 'orgA', projectId: 'p1' } } as Record<string, unknown>;
    const guard = new ProjectAccessGuard(reflector(['project:read']) as never, prisma as never);
    await expect(guard.canActivate(contextFor(request))).resolves.toBe(true);
    expect((request.projectAccess as { isAdmin: boolean }).isAdmin).toBe(false);
    expect((request.project as { memberCount: number }).memberCount).toBe(2);
  });

  it('denies management to a plain org member who is not a project admin (403)', async () => {
    const prisma = { project: { findFirst: jest.fn().mockResolvedValue(project) }, projectMember: { findUnique: jest.fn().mockResolvedValue({ role: 'MEMBER' }) } };
    const request = { user: { sub: 'A' }, orgMembership: { role: 'MEMBER' }, params: { organizationId: 'orgA', projectId: 'p1' } };
    const guard = new ProjectAccessGuard(reflector(['project:manage_members']) as never, prisma as never);
    await expect(guard.canActivate(contextFor(request))).rejects.toBeInstanceOf(ForbiddenException);
  });

  it('grants management to an org OWNER even without explicit project membership', async () => {
    const prisma = { project: { findFirst: jest.fn().mockResolvedValue(project) }, projectMember: { findUnique: jest.fn().mockResolvedValue(null) } };
    const request = { user: { sub: 'A' }, orgMembership: { role: 'OWNER' }, params: { organizationId: 'orgA', projectId: 'p1' } } as Record<string, unknown>;
    const guard = new ProjectAccessGuard(reflector(['project:update']) as never, prisma as never);
    await expect(guard.canActivate(contextFor(request))).resolves.toBe(true);
    expect((request.projectAccess as { isAdmin: boolean; effectiveRole: string }).isAdmin).toBe(true);
    expect((request.projectAccess as { effectiveRole: string }).effectiveRole).toBe('ADMIN');
  });

  it('grants management to a project ADMIN who is only an org MEMBER', async () => {
    const prisma = { project: { findFirst: jest.fn().mockResolvedValue(project) }, projectMember: { findUnique: jest.fn().mockResolvedValue({ role: 'ADMIN' }) } };
    const request = { user: { sub: 'A' }, orgMembership: { role: 'MEMBER' }, params: { organizationId: 'orgA', projectId: 'p1' } };
    const guard = new ProjectAccessGuard(reflector(['project:manage_members']) as never, prisma as never);
    await expect(guard.canActivate(contextFor(request))).resolves.toBe(true);
  });

  it('allows a project MEMBER to contribute but denies a project VIEWER', async () => {
    const asRole = (role: string) => ({ project: { findFirst: jest.fn().mockResolvedValue(project) }, projectMember: { findUnique: jest.fn().mockResolvedValue({ role }) } });
    const member = new ProjectAccessGuard(reflector(['project:contribute']) as never, asRole('MEMBER') as never);
    await expect(member.canActivate(contextFor({ user: { sub: 'A' }, orgMembership: { role: 'MEMBER' }, params: { organizationId: 'orgA', projectId: 'p1' } }))).resolves.toBe(true);
    const viewer = new ProjectAccessGuard(reflector(['project:contribute']) as never, asRole('VIEWER') as never);
    await expect(viewer.canActivate(contextFor({ user: { sub: 'A' }, orgMembership: { role: 'MEMBER' }, params: { organizationId: 'orgA', projectId: 'p1' } }))).rejects.toBeInstanceOf(ForbiddenException);
  });
});
