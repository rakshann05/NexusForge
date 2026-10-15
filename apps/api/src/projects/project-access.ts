import {
  CanActivate,
  createParamDecorator,
  ExecutionContext,
  ForbiddenException,
  Injectable,
  NotFoundException,
  SetMetadata,
} from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { ProjectRole } from '@prisma/client';
import { AuthenticatedUser } from '../common/auth';
import { PrismaService } from '../common/prisma.module';
import { OrgMembershipContext } from '../organizations/org-access';

/**
 * Project-scoped authorization. Runs AFTER JwtAuthGuard and OrgAccessGuard, so
 * the caller's organization membership (req.orgMembership) is already resolved
 * and verified. This guard additionally:
 *   1. loads the project by BOTH id and organizationId (404 if it does not
 *      belong to the org in the route) — projectId is never trusted alone;
 *   2. resolves the caller's ProjectMember (may be null);
 *   3. computes effective project-admin: an org OWNER/ADMIN has full authority
 *      over every project in their org, OR the caller is a project ADMIN;
 *   4. enforces the required @ProjectPermissions.
 *
 * project:read is satisfied by organization access alone (org members may see
 * their org's projects); management permissions require effective project-admin.
 */
export type ProjectPermission = 'project:read' | 'project:update' | 'project:manage_members' | 'project:delete';

const MANAGE: ProjectPermission[] = ['project:update', 'project:manage_members', 'project:delete'];

const PROJECT_PERMISSIONS_KEY = 'project.permissions';
export const ProjectPermissions = (...permissions: ProjectPermission[]) => SetMetadata(PROJECT_PERMISSIONS_KEY, permissions);

export interface ProjectContext {
  id: string;
  name: string;
  description: string | null;
  organizationId: string;
  archivedAt: Date | null;
  createdAt: Date;
  updatedAt: Date;
  organization: { id: string; name: string };
  memberCount: number;
}

export interface ProjectAccessContext {
  /** The caller's explicit project role, or null if they are not a project member. */
  membershipRole: ProjectRole | null;
  /** True when the caller may manage the project (org OWNER/ADMIN or project ADMIN). */
  isAdmin: boolean;
  /** Best-effort role to display for the caller (explicit, else implicit admin, else null). */
  effectiveRole: ProjectRole | null;
}

export const CurrentProject = createParamDecorator(
  (_data: unknown, context: ExecutionContext): ProjectContext => context.switchToHttp().getRequest().project,
);

export const ProjectAccess = createParamDecorator(
  (_data: unknown, context: ExecutionContext): ProjectAccessContext => context.switchToHttp().getRequest().projectAccess,
);

type GuardedRequest = {
  user?: AuthenticatedUser;
  params: Record<string, string>;
  orgMembership?: OrgMembershipContext;
  project?: ProjectContext;
  projectAccess?: ProjectAccessContext;
};

@Injectable()
export class ProjectAccessGuard implements CanActivate {
  constructor(private readonly reflector: Reflector, private readonly prisma: PrismaService) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const request = context.switchToHttp().getRequest<GuardedRequest>();
    const user = request.user;
    const orgMembership = request.orgMembership;
    if (!user || !orgMembership) throw new ForbiddenException('Authentication required');

    const { organizationId, projectId } = request.params;

    const project = await this.prisma.project.findFirst({
      // Scoped by BOTH ids: a project from another org (or a bad id) is a 404.
      where: { id: projectId, organizationId },
      select: {
        id: true,
        name: true,
        description: true,
        organizationId: true,
        archivedAt: true,
        createdAt: true,
        updatedAt: true,
        organization: { select: { id: true, name: true } },
        _count: { select: { members: true } },
      },
    });
    if (!project) throw new NotFoundException('Project not found');

    const membership = await this.prisma.projectMember.findUnique({
      where: { userId_projectId: { userId: user.sub, projectId } },
      select: { role: true },
    });

    const orgAdmin = orgMembership.role === 'OWNER' || orgMembership.role === 'ADMIN';
    const isAdmin = orgAdmin || membership?.role === ProjectRole.ADMIN;
    const effectiveRole = membership?.role ?? (orgAdmin ? ProjectRole.ADMIN : null);

    request.project = { ...project, memberCount: project._count.members };
    request.projectAccess = { membershipRole: membership?.role ?? null, isAdmin, effectiveRole };

    const required = this.reflector.getAllAndOverride<ProjectPermission[]>(PROJECT_PERMISSIONS_KEY, [
      context.getHandler(),
      context.getClass(),
    ]);
    for (const permission of required ?? []) {
      if (MANAGE.includes(permission) && !isAdmin) {
        throw new ForbiddenException('You do not have permission to manage this project.');
      }
    }
    return true;
  }
}
