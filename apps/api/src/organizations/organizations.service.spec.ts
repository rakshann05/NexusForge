import { BadRequestException, ConflictException, ForbiddenException, NotFoundException } from '@nestjs/common';
import { OrganizationRole } from '@prisma/client';
import { OrganizationsService } from './organizations.service';

const audit = () => ({ record: jest.fn().mockResolvedValue(undefined) });
const owner = { id: 'm', role: OrganizationRole.OWNER, userId: 'owner1', organizationId: 'org1' };
const admin = { id: 'm', role: OrganizationRole.ADMIN, userId: 'admin1', organizationId: 'org1' };
const member = { id: 'm', role: OrganizationRole.MEMBER, userId: 'member1', organizationId: 'org1' };
const safeUser = { id: 'u2', username: 'u2', displayName: 'U2', email: 'u2@x.dev', avatarUrl: null };

describe('OrganizationsService', () => {
  it('creates an organization with the caller as OWNER and audits it', async () => {
    const org = { id: 'org1', name: 'Acme', slug: 'acme', description: null, createdAt: new Date(), updatedAt: new Date() };
    const a = audit();
    const prisma = { organization: { create: jest.fn().mockResolvedValue(org) } };
    const service = new OrganizationsService(prisma as never, a as never);
    const result = await service.create('owner1', { name: 'Acme' });
    expect(result.role).toBe('OWNER');
    expect(result.memberCount).toBe(1);
    expect(prisma.organization.create).toHaveBeenCalledWith(
      expect.objectContaining({ data: expect.objectContaining({ members: { create: { userId: 'owner1', role: 'OWNER' } } }) }),
    );
    expect(a.record).toHaveBeenCalledWith(expect.objectContaining({ action: 'organization.created' }));
  });

  it('rejects adding a duplicate member (409)', async () => {
    const prisma = {
      user: { findFirst: jest.fn().mockResolvedValue(safeUser) },
      organizationMember: { findUnique: jest.fn().mockResolvedValue({ id: 'exists' }) },
    };
    const service = new OrganizationsService(prisma as never, audit() as never);
    await expect(service.addMember('org1', { identifier: 'u2@x.dev' }, owner)).rejects.toBeInstanceOf(ConflictException);
  });

  it('rejects adding a user that does not exist (404)', async () => {
    const prisma = { user: { findFirst: jest.fn().mockResolvedValue(null) } };
    const service = new OrganizationsService(prisma as never, audit() as never);
    await expect(service.addMember('org1', { identifier: 'ghost' }, owner)).rejects.toBeInstanceOf(NotFoundException);
  });

  it('forbids an admin from adding an OWNER', async () => {
    const service = new OrganizationsService({} as never, audit() as never);
    await expect(service.addMember('org1', { identifier: 'x', role: OrganizationRole.OWNER }, admin)).rejects.toBeInstanceOf(ForbiddenException);
  });

  it('prevents demoting the last owner', async () => {
    const prisma = { organizationMember: { findUnique: jest.fn().mockResolvedValue({ role: 'OWNER' }), count: jest.fn().mockResolvedValue(1) } };
    const service = new OrganizationsService(prisma as never, audit() as never);
    await expect(service.changeMemberRole('org1', 'owner1', OrganizationRole.ADMIN, owner)).rejects.toBeInstanceOf(BadRequestException);
  });

  it('forbids an admin from granting the OWNER role (privilege-escalation guard)', async () => {
    const prisma = { organizationMember: { findUnique: jest.fn().mockResolvedValue({ role: 'MEMBER' }) } };
    const service = new OrganizationsService(prisma as never, audit() as never);
    await expect(service.changeMemberRole('org1', 'u2', OrganizationRole.OWNER, admin)).rejects.toBeInstanceOf(ForbiddenException);
  });

  it('lets an owner change a member role and audits it', async () => {
    const a = audit();
    const prisma = {
      organizationMember: {
        findUnique: jest.fn().mockResolvedValue({ role: 'MEMBER' }),
        update: jest.fn().mockResolvedValue({ id: 'm2', role: 'ADMIN', createdAt: new Date(), user: safeUser }),
        count: jest.fn(),
      },
    };
    const service = new OrganizationsService(prisma as never, a as never);
    const result = await service.changeMemberRole('org1', 'u2', OrganizationRole.ADMIN, owner);
    expect(result.role).toBe('ADMIN');
    expect(a.record).toHaveBeenCalledWith(expect.objectContaining({ action: 'organization.member_role_changed' }));
  });

  it('prevents removing the last owner', async () => {
    const prisma = { organizationMember: { findUnique: jest.fn().mockResolvedValue({ id: 'm', role: 'OWNER' }), count: jest.fn().mockResolvedValue(1) } };
    const service = new OrganizationsService(prisma as never, audit() as never);
    await expect(service.removeMember('org1', 'owner1', owner)).rejects.toBeInstanceOf(BadRequestException);
  });

  it('forbids a plain member from removing another member', async () => {
    const prisma = { organizationMember: { findUnique: jest.fn().mockResolvedValue({ id: 'm2', role: 'MEMBER' }) } };
    const service = new OrganizationsService(prisma as never, audit() as never);
    await expect(service.removeMember('org1', 'someone-else', member)).rejects.toBeInstanceOf(ForbiddenException);
  });

  it('lets a member remove themselves (leave) and audits it', async () => {
    const a = audit();
    const prisma = {
      organizationMember: { findUnique: jest.fn().mockResolvedValue({ id: 'm2', role: 'MEMBER' }), delete: jest.fn().mockResolvedValue({}) },
    };
    const service = new OrganizationsService(prisma as never, a as never);
    await expect(service.removeMember('org1', 'member1', member)).resolves.toBeUndefined();
    expect(a.record).toHaveBeenCalledWith(expect.objectContaining({ action: 'organization.member_removed' }));
  });
});
