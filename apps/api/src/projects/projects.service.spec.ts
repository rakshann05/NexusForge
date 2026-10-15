import { BadRequestException, ConflictException, ForbiddenException, NotFoundException } from '@nestjs/common';
import { ProjectRole } from '@prisma/client';
import { ProjectsService } from './projects.service';

const audit = () => ({ record: jest.fn().mockResolvedValue(undefined) });
const orgOwner = { id: 'm', role: 'OWNER', userId: 'owner1', organizationId: 'orgA' } as never;
const orgMember = { id: 'm', role: 'MEMBER', userId: 'member1', organizationId: 'orgA' } as never;
const project = {
  id: 'p1', name: 'P', description: null, organizationId: 'orgA', archivedAt: null,
  createdAt: new Date(), updatedAt: new Date(), organization: { id: 'orgA', name: 'A' }, memberCount: 1,
} as never;
const memberAccess = { membershipRole: null, isAdmin: false, effectiveRole: null } as never;
const safeUser = { id: 'u2', username: 'u2', displayName: 'U2', email: 'u2@x.dev', avatarUrl: null };

describe('ProjectsService', () => {
  it('lets an org OWNER create a project (creator becomes project ADMIN) and audits it', async () => {
    const created = { ...(project as object), _count: { members: 1 } };
    const a = audit();
    const prisma = { project: { create: jest.fn().mockResolvedValue(created) } };
    const service = new ProjectsService(prisma as never, a as never);
    const result = await service.create('orgA', orgOwner, { name: 'Proj' });
    expect(result.role).toBe('ADMIN');
    expect(prisma.project.create).toHaveBeenCalledWith(
      expect.objectContaining({ data: expect.objectContaining({ organizationId: 'orgA', members: { create: { userId: 'owner1', role: 'ADMIN' } } }) }),
    );
    expect(a.record).toHaveBeenCalledWith(expect.objectContaining({ action: 'project.created' }));
  });

  it('forbids an org MEMBER from creating a project (403)', async () => {
    const service = new ProjectsService({} as never, audit() as never);
    await expect(service.create('orgA', orgMember, { name: 'Proj' })).rejects.toBeInstanceOf(ForbiddenException);
  });

  it('rejects adding a user who is not a member of the organization (400)', async () => {
    const prisma = { user: { findFirst: jest.fn().mockResolvedValue(safeUser) }, organizationMember: { findUnique: jest.fn().mockResolvedValue(null) } };
    const service = new ProjectsService(prisma as never, audit() as never);
    await expect(service.addMember(project, { identifier: 'u2@x.dev' }, 'owner1')).rejects.toBeInstanceOf(BadRequestException);
  });

  it('rejects adding an unknown user (404)', async () => {
    const prisma = { user: { findFirst: jest.fn().mockResolvedValue(null) } };
    const service = new ProjectsService(prisma as never, audit() as never);
    await expect(service.addMember(project, { identifier: 'ghost' }, 'owner1')).rejects.toBeInstanceOf(NotFoundException);
  });

  it('rejects a duplicate project membership (409)', async () => {
    const prisma = {
      user: { findFirst: jest.fn().mockResolvedValue(safeUser) },
      organizationMember: { findUnique: jest.fn().mockResolvedValue({ id: 'om' }) },
      projectMember: { findUnique: jest.fn().mockResolvedValue({ id: 'exists' }) },
    };
    const service = new ProjectsService(prisma as never, audit() as never);
    await expect(service.addMember(project, { identifier: 'u2@x.dev' }, 'owner1')).rejects.toBeInstanceOf(ConflictException);
  });

  it('adds an existing org member to the project and audits it', async () => {
    const a = audit();
    const prisma = {
      user: { findFirst: jest.fn().mockResolvedValue(safeUser) },
      organizationMember: { findUnique: jest.fn().mockResolvedValue({ id: 'om' }) },
      projectMember: { findUnique: jest.fn().mockResolvedValue(null), create: jest.fn().mockResolvedValue({ id: 'pm1', role: 'MEMBER', createdAt: new Date() }) },
    };
    const service = new ProjectsService(prisma as never, a as never);
    const result = await service.addMember(project, { identifier: 'u2@x.dev' }, 'owner1');
    expect(result.user.id).toBe('u2');
    expect(a.record).toHaveBeenCalledWith(expect.objectContaining({ action: 'project.member_added' }));
  });

  it('forbids a non-admin from removing another project member', async () => {
    const prisma = { projectMember: { findUnique: jest.fn().mockResolvedValue({ id: 'pm2', role: 'MEMBER' }) } };
    const service = new ProjectsService(prisma as never, audit() as never);
    await expect(service.removeMember(project, 'someone-else', memberAccess, 'member1')).rejects.toBeInstanceOf(ForbiddenException);
  });

  it('lets a member remove themselves (leave) and audits it', async () => {
    const a = audit();
    const prisma = { projectMember: { findUnique: jest.fn().mockResolvedValue({ id: 'pm2', role: 'MEMBER' }), delete: jest.fn().mockResolvedValue({}) } };
    const service = new ProjectsService(prisma as never, a as never);
    await expect(service.removeMember(project, 'member1', memberAccess, 'member1')).resolves.toBeUndefined();
    expect(a.record).toHaveBeenCalledWith(expect.objectContaining({ action: 'project.member_removed' }));
  });

  it('lets an admin change a member role and audits it', async () => {
    const a = audit();
    const prisma = {
      projectMember: {
        findUnique: jest.fn().mockResolvedValue({ role: 'MEMBER' }),
        update: jest.fn().mockResolvedValue({ id: 'pm2', role: 'ADMIN', createdAt: new Date(), user: safeUser }),
      },
    };
    const service = new ProjectsService(prisma as never, a as never);
    const result = await service.changeMemberRole(project, 'u2', ProjectRole.ADMIN, 'owner1');
    expect(result.role).toBe('ADMIN');
    expect(a.record).toHaveBeenCalledWith(expect.objectContaining({ action: 'project.member_role_changed' }));
  });

  it('archives (soft-deletes) a project and audits it', async () => {
    const a = audit();
    const prisma = { project: { update: jest.fn().mockResolvedValue({}) } };
    const service = new ProjectsService(prisma as never, a as never);
    await service.archive(project, 'owner1');
    expect(prisma.project.update).toHaveBeenCalledWith(expect.objectContaining({ data: expect.objectContaining({ archivedAt: expect.any(Date) }) }));
    expect(a.record).toHaveBeenCalledWith(expect.objectContaining({ action: 'project.archived' }));
  });
});
