import { BadRequestException, ConflictException, ForbiddenException, Injectable, NotFoundException } from '@nestjs/common';
import { OrganizationRole } from '@prisma/client';
import { AuditService } from '../audit/audit.module';
import { PrismaService } from '../common/prisma.module';
import { OrgMembershipContext, roleHasPermission } from './org-access';

export type CreateOrganizationInput = { name: string; description?: string; slug?: string };
export type UpdateOrganizationInput = { name?: string; description?: string };
export type AddMemberInput = { identifier: string; role?: OrganizationRole };

// Only non-sensitive user fields ever leave the members API.
const memberUserSelect = { id: true, username: true, displayName: true, email: true, avatarUrl: true } as const;
const orgSelect = { id: true, name: true, slug: true, description: true, createdAt: true, updatedAt: true } as const;

const toSlug = (value: string) =>
  value
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/(^-|-$)/g, '');

type OrgRow = { id: string; name: string; slug: string; description: string | null; createdAt: Date; updatedAt: Date };

@Injectable()
export class OrganizationsService {
  constructor(private readonly prisma: PrismaService, private readonly audit: AuditService) {}

  private shape(org: OrgRow, role: OrganizationRole, memberCount: number) {
    return { id: org.id, name: org.name, slug: org.slug, description: org.description, createdAt: org.createdAt, updatedAt: org.updatedAt, memberCount, role };
  }

  /** Organizations the user belongs to, with their role and member count (for the switcher). */
  async list(userId: string) {
    const memberships = await this.prisma.organizationMember.findMany({
      where: { userId },
      select: { role: true, organization: { select: { ...orgSelect, _count: { select: { members: true } } } } },
      orderBy: { organization: { name: 'asc' } },
    });
    return memberships.map((m) => this.shape(m.organization, m.role, m.organization._count.members));
  }

  async create(userId: string, dto: CreateOrganizationInput) {
    const name = dto.name.trim();
    const description = dto.description?.trim() || null;
    const slug = dto.slug?.trim() || toSlug(name);
    if (!slug) throw new BadRequestException('A valid organization name is required.');
    try {
      const org = await this.prisma.organization.create({
        data: { name, slug, description, members: { create: { userId, role: OrganizationRole.OWNER } } },
        select: orgSelect,
      });
      await this.audit.record({ actorId: userId, organizationId: org.id, action: 'organization.created', entityType: 'Organization', entityId: org.id, metadata: { name } });
      return this.shape(org, OrganizationRole.OWNER, 1);
    } catch (error: unknown) {
      if ((error as { code?: string }).code === 'P2002') throw new ConflictException('That organization name or slug is already in use.');
      throw error;
    }
  }

  /** Kept for projects/documents modules: returns the membership or 404. */
  async getMember(organizationId: string, userId: string) {
    const membership = await this.prisma.organizationMember.findUnique({ where: { userId_organizationId: { userId, organizationId } } });
    if (!membership) throw new NotFoundException('Organization not found');
    return membership;
  }

  async get(organizationId: string, membership: OrgMembershipContext) {
    const org = await this.prisma.organization.findUnique({ where: { id: organizationId }, select: { ...orgSelect, _count: { select: { members: true } } } });
    if (!org) throw new NotFoundException('Organization not found');
    return this.shape(org, membership.role, org._count.members);
  }

  async update(organizationId: string, dto: UpdateOrganizationInput, membership: OrgMembershipContext) {
    const data: { name?: string; description?: string | null } = {};
    if (dto.name !== undefined) data.name = dto.name.trim();
    if (dto.description !== undefined) data.description = dto.description.trim() || null;
    if (Object.keys(data).length === 0) throw new BadRequestException('No changes provided.');
    try {
      const org = await this.prisma.organization.update({ where: { id: organizationId }, data, select: { ...orgSelect, _count: { select: { members: true } } } });
      await this.audit.record({ actorId: membership.userId, organizationId, action: 'organization.updated', entityType: 'Organization', entityId: organizationId, metadata: { fields: Object.keys(data) } });
      return this.shape(org, membership.role, org._count.members);
    } catch (error: unknown) {
      if ((error as { code?: string }).code === 'P2002') throw new ConflictException('That organization name is already in use.');
      throw error;
    }
  }

  async listMembers(organizationId: string) {
    const members = await this.prisma.organizationMember.findMany({
      where: { organizationId },
      select: { id: true, role: true, createdAt: true, user: { select: memberUserSelect } },
      orderBy: [{ role: 'asc' }, { createdAt: 'asc' }],
    });
    return members.map((m) => ({ id: m.id, role: m.role, joinedAt: m.createdAt, user: m.user }));
  }

  async addMember(organizationId: string, dto: AddMemberInput, actor: OrgMembershipContext) {
    const role = dto.role ?? OrganizationRole.MEMBER;
    if (role === OrganizationRole.OWNER && actor.role !== OrganizationRole.OWNER) {
      throw new ForbiddenException('Only an owner can add another owner.');
    }
    const identifier = dto.identifier.trim().toLowerCase();
    const user = await this.prisma.user.findFirst({ where: { OR: [{ email: identifier }, { username: identifier }] }, select: memberUserSelect });
    if (!user) throw new NotFoundException('No user found with that email or username.');
    const existing = await this.prisma.organizationMember.findUnique({ where: { userId_organizationId: { userId: user.id, organizationId } } });
    if (existing) throw new ConflictException('That user is already a member of this organization.');
    const membership = await this.prisma.organizationMember.create({ data: { organizationId, userId: user.id, role } });
    await this.audit.record({ actorId: actor.userId, organizationId, action: 'organization.member_added', entityType: 'OrganizationMember', entityId: membership.id, metadata: { targetUserId: user.id, role } });
    return { id: membership.id, role: membership.role, joinedAt: membership.createdAt, user };
  }

  async changeMemberRole(organizationId: string, targetUserId: string, role: OrganizationRole, actor: OrgMembershipContext) {
    const target = await this.prisma.organizationMember.findUnique({ where: { userId_organizationId: { userId: targetUserId, organizationId } } });
    if (!target) throw new NotFoundException('That user is not a member of this organization.');
    // Only an owner may grant or revoke the OWNER role (prevents admin self-escalation).
    if ((role === OrganizationRole.OWNER || target.role === OrganizationRole.OWNER) && actor.role !== OrganizationRole.OWNER) {
      throw new ForbiddenException('Only an owner can change owner roles.');
    }
    // Never leave the organization without an owner.
    if (target.role === OrganizationRole.OWNER && role !== OrganizationRole.OWNER && (await this.ownerCount(organizationId)) <= 1) {
      throw new BadRequestException('An organization must always have at least one owner.');
    }
    const updated = await this.prisma.organizationMember.update({
      where: { userId_organizationId: { userId: targetUserId, organizationId } },
      data: { role },
      select: { id: true, role: true, createdAt: true, user: { select: memberUserSelect } },
    });
    await this.audit.record({ actorId: actor.userId, organizationId, action: 'organization.member_role_changed', entityType: 'OrganizationMember', entityId: updated.id, metadata: { targetUserId, from: target.role, to: role } });
    return { id: updated.id, role: updated.role, joinedAt: updated.createdAt, user: updated.user };
  }

  async removeMember(organizationId: string, targetUserId: string, actor: OrgMembershipContext) {
    const target = await this.prisma.organizationMember.findUnique({ where: { userId_organizationId: { userId: targetUserId, organizationId } } });
    if (!target) throw new NotFoundException('That user is not a member of this organization.');
    const isSelf = targetUserId === actor.userId;
    // Members may remove only themselves (leave); removing others needs manage_members.
    if (!isSelf && !roleHasPermission(actor.role, 'organization:manage_members')) {
      throw new ForbiddenException('You do not have permission to perform this action.');
    }
    if (target.role === OrganizationRole.OWNER) {
      if ((await this.ownerCount(organizationId)) <= 1) {
        throw new BadRequestException('An organization must always have at least one owner. Assign another owner first.');
      }
      if (!isSelf && actor.role !== OrganizationRole.OWNER) throw new ForbiddenException('Only an owner can remove another owner.');
    }
    await this.prisma.organizationMember.delete({ where: { userId_organizationId: { userId: targetUserId, organizationId } } });
    await this.audit.record({ actorId: actor.userId, organizationId, action: 'organization.member_removed', entityType: 'OrganizationMember', entityId: target.id, metadata: { targetUserId, role: target.role, self: isSelf } });
  }

  private ownerCount(organizationId: string) {
    return this.prisma.organizationMember.count({ where: { organizationId, role: OrganizationRole.OWNER } });
  }
}
