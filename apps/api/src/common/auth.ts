import { CanActivate, createParamDecorator, ExecutionContext, ForbiddenException, Injectable, SetMetadata, UnauthorizedException } from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import { Reflector } from '@nestjs/core';
import { PrismaService } from './prisma.module';

export interface AuthenticatedUser { sub: string; email: string; username: string; displayName: string; sid?: string; roles: string[]; }
export const CurrentUser = createParamDecorator((_data: unknown, context: ExecutionContext): AuthenticatedUser => context.switchToHttp().getRequest().user);
export const Roles = (...roles: string[]) => SetMetadata('roles', roles);
export const Permissions = (...permissions: string[]) => SetMetadata('permissions', permissions);

@Injectable()
export class JwtAuthGuard implements CanActivate {
  constructor(private readonly jwt: JwtService, private readonly prisma: PrismaService) {}
  async canActivate(context: ExecutionContext): Promise<boolean> {
    const request = context.switchToHttp().getRequest<{ headers: { authorization?: string }; user?: AuthenticatedUser }>();
    const token = request.headers.authorization?.replace(/^Bearer\s+/i, '');
    if (!token) throw new UnauthorizedException('A bearer token is required');
    try {
      const user = await this.jwt.verifyAsync<AuthenticatedUser>(token, { secret: process.env.JWT_ACCESS_SECRET });
      if (!user.sid) throw new UnauthorizedException('Invalid access token');
      const session = await this.prisma.session.findUnique({ where: { id: user.sid }, select: { userId: true, revokedAt: true, expiresAt: true } });
      if (!session || session.userId !== user.sub || session.revokedAt || session.expiresAt < new Date()) throw new UnauthorizedException('Session is no longer active');
      request.user = user;
      return true;
    } catch { throw new UnauthorizedException('Invalid or expired access token'); }
  }
}

@Injectable()
export class RolesGuard implements CanActivate {
  constructor(private readonly reflector: Reflector, private readonly prisma: PrismaService) {}
  async canActivate(context: ExecutionContext) {
    const roles = this.reflector.getAllAndOverride<string[]>('roles', [context.getHandler(), context.getClass()]);
    if (!roles?.length) return true;
    const user = context.switchToHttp().getRequest<{ user?: AuthenticatedUser }>().user;
    if (!user) throw new ForbiddenException('Insufficient role');
    const assignedRoles = await this.prisma.userRole.findMany({ where: { userId: user.sub }, include: { role: { select: { key: true } } } });
    if (!assignedRoles.some(({ role }) => roles.includes(role.key))) throw new ForbiddenException('Insufficient role');
    return true;
  }
}

@Injectable()
export class PermissionsGuard implements CanActivate {
  constructor(private readonly reflector: Reflector, private readonly prisma: PrismaService) {}
  async canActivate(context: ExecutionContext) {
    const permissions = this.reflector.getAllAndOverride<string[]>('permissions', [context.getHandler(), context.getClass()]);
    if (!permissions?.length) return true;
    const user = context.switchToHttp().getRequest<{ user?: AuthenticatedUser }>().user;
    if (!user) throw new ForbiddenException('Insufficient permission');
    const roles = await this.prisma.userRole.findMany({ where: { userId: user.sub }, include: { role: { include: { permissions: { include: { permission: true } } } } } });
    const granted = new Set(roles.flatMap(({ role }) => role.permissions.map(({ permission }) => permission.key)));
    if (!permissions.every((permission) => granted.has(permission))) throw new ForbiddenException('Insufficient permission');
    return true;
  }
}
