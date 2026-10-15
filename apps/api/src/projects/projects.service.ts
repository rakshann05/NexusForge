import { BadRequestException, ConflictException, ForbiddenException, Injectable, NotFoundException } from '@nestjs/common';
import { ProjectRole } from '@prisma/client';
import { AuditService } from '../audit/audit.module';
import { PrismaService } from '../common/prisma.module';
import { OrgMembershipContext } from '../organizations/org-access';
import { ProjectAccessContext, ProjectContext } from './project-access';

export type CreateProjectInput = { name: string; description?: string };
export type UpdateProjectInput = { name?: string; description?: string };
export type AddProjectMemberInput = { identifier: string; role?: ProjectRole };

const memberUserSelect = { id: true, username: true, displayName: true, email: true, avatarUrl: true } as const;
const projectSelect = {
  id: true,
  name: true,
  description: true,
  organizationId: true,
  archivedAt: true,
  createdAt: true,
  updatedAt: true,
  organization: { select: { id: true, name: true } },
  _count: { select: { members: true } },
} as const;

type ProjectFields = {
  id: string;
  name: string;
  description: string | null;
  organizationId: string;
  archivedAt: Date | null;
  createdAt: Date;
  updatedAt: Date;
  organization: { id: string; name: string };
};

@Injectable()
export class ProjectsService {
  constructor(private readonly prisma: PrismaService, private readonly audit: AuditService) {}

  private view(project: ProjectFields, role: ProjectRole | null, memberCount: number) {
    return {
      id: project.id,
      name: project.name,
      description: project.description,
      organizationId: project.organizationId,
      organization: project.organization,
      archivedAt: project.archivedAt,
      createdAt: project.createdAt,
      updatedAt: project.updatedAt,
      memberCount,
      role,
    };
  }

  /** Non-archived projects in the organization, with the caller's project role. */
  async list(organizationId: string, userId: string) {
    const projects = await this.prisma.project.findMany({
      where: { organizationId, archivedAt: null },
      select: { ...projectSelect, members: { where: { userId }, select: { role: true } } },
      orderBy: { updatedAt: 'desc' },
    });
    return projects.map((p) => this.view(p, p.members[0]?.role ?? null, p._count.members));
  }

  async create(organizationId: string, orgMembership: OrgMembershipContext, dto: CreateProjectInput) {
    // Creating a project is an organization-management action.
    if (orgMembership.role !== 'OWNER' && orgMembership.role !== 'ADMIN') {
      throw new ForbiddenException('You do not have permission to create projects in this organization.');
    }
    const name = dto.name.trim();
    const description = dto.description?.trim() || null;
    const base = this.keyBase(name);
    for (let attempt = 0; attempt < 6; attempt++) {
      const key = attempt === 0 ? base : `${base}${this.suffix()}`;
      try {
        const project = await this.prisma.project.create({
          data: { name, description, key, organizationId, members: { create: { userId: orgMembership.userId, role: ProjectRole.ADMIN } } },
          select: projectSelect,
        });
        await this.audit.record({ organizationId, actorId: orgMembership.userId, action: 'project.created', entityType: 'Project', entityId: project.id, metadata: { name, key } });
        return this.view(project, ProjectRole.ADMIN, 1);
      } catch (error: unknown) {
        if ((error as { code?: string }).code === 'P2002' && attempt < 5) continue; // key collision, retry
        throw error;
      }
    }
    throw new ConflictException('Could not generate a unique project key. Please try a different name.');
  }

  get(project: ProjectContext, access: ProjectAccessContext) {
    return this.view(project, access.effectiveRole, project.memberCount);
  }

  async update(project: ProjectContext, dto: UpdateProjectInput, access: ProjectAccessContext, actorId: string) {
    const data: { name?: string; description?: string | null } = {};
    if (dto.name !== undefined) data.name = dto.name.trim();
    if (dto.description !== undefined) data.description = dto.description.trim() || null;
    if (Object.keys(data).length === 0) throw new BadRequestException('No changes provided.');
    const updated = await this.prisma.project.update({ where: { id: project.id }, data, select: projectSelect });
    await this.audit.record({ organizationId: project.organizationId, actorId, action: 'project.updated', entityType: 'Project', entityId: project.id, metadata: { fields: Object.keys(data) } });
    return this.view(updated, access.effectiveRole, updated._count.members);
  }

  /** Soft-delete: archive rather than destroy, preserving data and history. */
  async archive(project: ProjectContext, actorId: string) {
    if (project.archivedAt) return;
    await this.prisma.project.update({ where: { id: project.id }, data: { archivedAt: new Date() } });
    await this.audit.record({ organizationId: project.organizationId, actorId, action: 'project.archived', entityType: 'Project', entityId: project.id });
  }

  async listMembers(projectId: string) {
    const members = await this.prisma.projectMember.findMany({
      where: { projectId },
      select: { id: true, role: true, createdAt: true, user: { select: memberUserSelect } },
      orderBy: [{ role: 'asc' }, { createdAt: 'asc' }],
    });
    return members.map((m) => ({ id: m.id, role: m.role, joinedAt: m.createdAt, user: m.user }));
  }

  async addMember(project: ProjectContext, dto: AddProjectMemberInput, actorId: string) {
    const role = dto.role ?? ProjectRole.MEMBER;
    const identifier = dto.identifier.trim().toLowerCase();
    const user = await this.prisma.user.findFirst({ where: { OR: [{ email: identifier }, { username: identifier }] }, select: memberUserSelect });
    if (!user) throw new NotFoundException('No user found with that email or username.');
    // Invariant: a project member must belong to the parent organization.
    const orgMember = await this.prisma.organizationMember.findUnique({
      where: { userId_organizationId: { userId: user.id, organizationId: project.organizationId } },
      select: { id: true },
    });
    if (!orgMember) throw new BadRequestException('That user must be a member of this organization first.');
    const existing = await this.prisma.projectMember.findUnique({ where: { userId_projectId: { userId: user.id, projectId: project.id } } });
    if (existing) throw new ConflictException('That user is already a project member.');
    const membership = await this.prisma.projectMember.create({ data: { projectId: project.id, userId: user.id, role } });
    await this.audit.record({ organizationId: project.organizationId, actorId, action: 'project.member_added', entityType: 'ProjectMember', entityId: membership.id, metadata: { projectId: project.id, targetUserId: user.id, role } });
    return { id: membership.id, role: membership.role, joinedAt: membership.createdAt, user };
  }

  async changeMemberRole(project: ProjectContext, targetUserId: string, role: ProjectRole, actorId: string) {
    const target = await this.prisma.projectMember.findUnique({ where: { userId_projectId: { userId: targetUserId, projectId: project.id } } });
    if (!target) throw new NotFoundException('That user is not a project member.');
    const updated = await this.prisma.projectMember.update({
      where: { userId_projectId: { userId: targetUserId, projectId: project.id } },
      data: { role },
      select: { id: true, role: true, createdAt: true, user: { select: memberUserSelect } },
    });
    await this.audit.record({ organizationId: project.organizationId, actorId, action: 'project.member_role_changed', entityType: 'ProjectMember', entityId: updated.id, metadata: { projectId: project.id, targetUserId, from: target.role, to: role } });
    return { id: updated.id, role: updated.role, joinedAt: updated.createdAt, user: updated.user };
  }

  async removeMember(project: ProjectContext, targetUserId: string, access: ProjectAccessContext, actorUserId: string) {
    const target = await this.prisma.projectMember.findUnique({ where: { userId_projectId: { userId: targetUserId, projectId: project.id } } });
    if (!target) throw new NotFoundException('That user is not a project member.');
    const isSelf = targetUserId === actorUserId;
    // Members may remove only themselves (leave); removing others needs project-admin.
    if (!isSelf && !access.isAdmin) throw new ForbiddenException('You do not have permission to manage this project.');
    await this.prisma.projectMember.delete({ where: { userId_projectId: { userId: targetUserId, projectId: project.id } } });
    await this.audit.record({ organizationId: project.organizationId, actorId: actorUserId, action: 'project.member_removed', entityType: 'ProjectMember', entityId: target.id, metadata: { projectId: project.id, targetUserId, role: target.role, self: isSelf } });
  }

  private keyBase(name: string): string {
    const cleaned = name.toUpperCase().replace(/[^A-Z0-9]/g, '').replace(/^[0-9]+/, '');
    const base = (cleaned || 'PRJ').slice(0, 8);
    return base.length >= 2 ? base : `${base}PRJ`.slice(0, 3);
  }

  private suffix(): string {
    return Math.random().toString(36).slice(2, 4).toUpperCase().replace(/[^A-Z0-9]/g, '0');
  }
}
