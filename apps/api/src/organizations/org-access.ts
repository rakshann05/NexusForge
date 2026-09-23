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
import { OrganizationRole } from '@prisma/client';
import { AuthenticatedUser } from '../common/auth';
import { PrismaService } from '../common/prisma.module';

/**
 * Organization-scoped authorization.
 *
 * The global RBAC guards (RolesGuard / PermissionsGuard in common/auth.ts) check
 * a user's GLOBAL roles and are not tenant-aware, so they cannot express "may
 * update THIS organization". Authorization for organization resources is instead
 * derived from the caller's OrganizationMember.role — the tenant boundary the
 * schema already models. This guard follows the same Reflector + decorator
 * pattern as PermissionsGuard; it does not introduce a second auth system.
 */
export type OrgPermission = 'organization:read' | 'organization:update' | 'organization:manage_members';

export const ORG_ROLE_PERMISSIONS: Record<OrganizationRole, OrgPermission[]> = {
  OWNER: ['organization:read', 'organization:update', 'organization:manage_members'],
  ADMIN: ['organization:read', 'organization:update', 'organization:manage_members'],
  MEMBER: ['organization:read'],
  VIEWER: ['organization:read'],
};

export const roleHasPermission = (role: OrganizationRole, permission: OrgPermission): boolean =>
  ORG_ROLE_PERMISSIONS[role].includes(permission);

const ORG_PERMISSIONS_KEY = 'org.permissions';
export const OrgPermissions = (...permissions: OrgPermission[]) => SetMetadata(ORG_PERMISSIONS_KEY, permissions);

export interface OrgMembershipContext {
  id: string;
  role: OrganizationRole;
  userId: string;
  organizationId: string;
}

/** Injects the caller's membership (resolved by OrgAccessGuard) into a handler. */
export const OrgMembership = createParamDecorator(
  (_data: unknown, context: ExecutionContext): OrgMembershipContext =>
    context.switchToHttp().getRequest().orgMembership,
);

type GuardedRequest = {
  user?: AuthenticatedUser;
  params: Record<string, string>;
  orgMembership?: OrgMembershipContext;
};

@Injectable()
export class OrgAccessGuard implements CanActivate {
  constructor(private readonly reflector: Reflector, private readonly prisma: PrismaService) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const request = context.switchToHttp().getRequest<GuardedRequest>();
    const user = request.user;
    if (!user) throw new ForbiddenException('Authentication required');

    const organizationId = request.params.organizationId;
    if (!organizationId) throw new NotFoundException('Organization not found');

    const membership = await this.prisma.organizationMember.findUnique({
      where: { userId_organizationId: { userId: user.sub, organizationId } },
      select: { id: true, role: true, userId: true, organizationId: true },
    });
    // A non-member gets 404 (not 403): existence of another tenant's org is not disclosed.
    if (!membership) throw new NotFoundException('Organization not found');
    request.orgMembership = membership;

    const required = this.reflector.getAllAndOverride<OrgPermission[]>(ORG_PERMISSIONS_KEY, [
      context.getHandler(),
      context.getClass(),
    ]);
    for (const permission of required ?? []) {
      if (!roleHasPermission(membership.role, permission)) {
        throw new ForbiddenException('You do not have permission to perform this action.');
      }
    }
    return true;
  }
}
