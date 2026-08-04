import { ConflictException, Injectable, NotFoundException, UnauthorizedException } from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import * as bcrypt from 'bcrypt';
import { SystemRoleKey } from '@prisma/client';
import { AuditService } from '../audit/audit.module';
import { AuthenticatedUser } from '../common/auth';
import { PrismaService } from '../common/prisma.module';

type SessionContext = { ipAddress?: string; userAgent?: string };
type RegisterInput = { email: string; username: string; displayName: string; password: string };
type ProfileInput = { displayName?: string; bio?: string; timezone?: string; language?: string; theme?: string; avatarUrl?: string };
const refreshLifetimeMs = 7 * 24 * 60 * 60 * 1000;
const publicUser = (user: { id: string; email: string; username: string; displayName: string; avatarUrl: string | null; bio: string | null; timezone: string; language: string; theme: string }) => user;

@Injectable()
export class AuthService {
  constructor(private readonly prisma: PrismaService, private readonly jwt: JwtService, private readonly audit: AuditService) {}

  async register(input: RegisterInput, context: SessionContext) {
    const email = input.email.trim().toLowerCase();
    const username = input.username.trim().toLowerCase();
    const duplicate = await this.prisma.user.findFirst({ where: { OR: [{ email }, { username }] }, select: { email: true, username: true } });
    if (duplicate?.email === email) throw new ConflictException('Email is already registered');
    if (duplicate?.username === username) throw new ConflictException('Username is already registered');
    const memberRole = await this.prisma.role.upsert({ where: { key: SystemRoleKey.MEMBER }, update: {}, create: { key: SystemRoleKey.MEMBER, description: 'Standard workspace member' } });
    let user;
    try { user = await this.prisma.user.create({ data: { email, username, displayName: input.displayName.trim(), passwordHash: await bcrypt.hash(input.password, 12), roles: { create: { roleId: memberRole.id } } } }); }
    catch (error: unknown) { if ((error as { code?: string }).code === 'P2002') throw new ConflictException('Email or username is already registered'); throw error; }
    await this.audit.record({ actorId: user.id, action: 'identity.registered', entityType: 'User', entityId: user.id, metadata: { username } });
    return this.startSession(user.id, context);
  }

  async login(identifier: string, password: string, context: SessionContext) {
    const normalized = identifier.trim().toLowerCase();
    const user = await this.prisma.user.findFirst({ where: { OR: [{ email: normalized }, { username: normalized }] } });
    if (!user || !(await bcrypt.compare(password, user.passwordHash))) throw new UnauthorizedException('Invalid credentials');
    const session = await this.startSession(user.id, context);
    await this.audit.record({ actorId: user.id, action: 'identity.logged_in', entityType: 'Session', entityId: session.sessionId });
    return session;
  }

  async refresh(refreshToken: string, context: SessionContext) {
    let payload: AuthenticatedUser;
    try { payload = await this.jwt.verifyAsync<AuthenticatedUser>(refreshToken, { secret: process.env.JWT_REFRESH_SECRET }); } catch { throw new UnauthorizedException('Invalid or expired refresh token'); }
    if (!payload.sid) throw new UnauthorizedException('Invalid refresh token');
    const stored = await this.prisma.refreshToken.findUnique({ where: { sessionId: payload.sid }, include: { session: { include: { user: { include: { roles: { include: { role: true } } } } } } } });
    if (!stored || stored.revokedAt || stored.expiresAt < new Date() || stored.session.revokedAt || !(await bcrypt.compare(refreshToken, stored.tokenHash))) throw new UnauthorizedException('Invalid or revoked refresh token');
    await this.prisma.refreshToken.update({ where: { id: stored.id }, data: { revokedAt: new Date() } });
    const result = await this.issueTokens(stored.session.user, stored.session, context);
    await this.audit.record({ actorId: stored.userId, action: 'identity.refresh_rotated', entityType: 'Session', entityId: stored.sessionId });
    return result;
  }

  async logout(user: AuthenticatedUser) { await this.revokeSession(user.sub, user.sid); }
  async logoutAll(userId: string) { await this.prisma.$transaction([this.prisma.session.updateMany({ where: { userId, revokedAt: null }, data: { revokedAt: new Date() } }), this.prisma.refreshToken.updateMany({ where: { userId, revokedAt: null }, data: { revokedAt: new Date() } })]); await this.audit.record({ actorId: userId, action: 'identity.logout_all', entityType: 'User', entityId: userId }); }

  async profile(userId: string) { const user = await this.prisma.user.findUnique({ where: { id: userId }, select: { id: true, email: true, username: true, displayName: true, avatarUrl: true, bio: true, timezone: true, language: true, theme: true } }); if (!user) throw new NotFoundException('User not found'); return publicUser(user); }
  async updateProfile(userId: string, input: ProfileInput) { const user = await this.prisma.user.update({ where: { id: userId }, data: input, select: { id: true, email: true, username: true, displayName: true, avatarUrl: true, bio: true, timezone: true, language: true, theme: true } }); await this.audit.record({ actorId: userId, action: 'identity.profile_updated', entityType: 'User', entityId: userId }); return publicUser(user); }
  async sessions(user: AuthenticatedUser) { return this.prisma.session.findMany({ where: { userId: user.sub }, select: { id: true, deviceName: true, userAgent: true, ipAddress: true, createdAt: true, lastActiveAt: true, expiresAt: true, revokedAt: true }, orderBy: { lastActiveAt: 'desc' } }).then((sessions) => sessions.map((session) => ({ ...session, current: session.id === user.sid }))); }
  async revokeSession(userId: string, sessionId: string | undefined) { if (!sessionId) return; const session = await this.prisma.session.findFirst({ where: { id: sessionId, userId } }); if (!session) throw new NotFoundException('Session not found'); await this.prisma.$transaction([this.prisma.session.update({ where: { id: sessionId }, data: { revokedAt: new Date() } }), this.prisma.refreshToken.updateMany({ where: { sessionId, revokedAt: null }, data: { revokedAt: new Date() } })]); await this.audit.record({ actorId: userId, action: 'identity.session_revoked', entityType: 'Session', entityId: sessionId }); }
  async roles(userId: string) { return this.prisma.userRole.findMany({ where: { userId }, include: { role: { include: { permissions: { include: { permission: true } } } } } }); }

  private async startSession(userId: string, context: SessionContext) { const session = await this.prisma.session.create({ data: { userId, ipAddress: context.ipAddress, userAgent: context.userAgent, deviceName: this.deviceName(context.userAgent), expiresAt: new Date(Date.now() + refreshLifetimeMs) } }); const user = await this.userWithRoles(userId); return this.issueTokens(user, session, context); }
  private async issueTokens(user: Awaited<ReturnType<AuthService['userWithRoles']>>, session: { id: string }, context: SessionContext) { const payload = { sub: user.id, email: user.email, username: user.username, displayName: user.displayName, sid: session.id, roles: user.roles.map(({ role }) => role.key) }; const accessToken = await this.jwt.signAsync(payload, { secret: process.env.JWT_ACCESS_SECRET, expiresIn: (process.env.JWT_ACCESS_TTL ?? '15m') as never }); const refreshToken = await this.jwt.signAsync(payload, { secret: process.env.JWT_REFRESH_SECRET, expiresIn: (process.env.JWT_REFRESH_TTL ?? '7d') as never }); await this.prisma.refreshToken.upsert({ where: { sessionId: session.id }, update: { tokenHash: await bcrypt.hash(refreshToken, 12), revokedAt: null, expiresAt: new Date(Date.now() + refreshLifetimeMs) }, create: { tokenHash: await bcrypt.hash(refreshToken, 12), expiresAt: new Date(Date.now() + refreshLifetimeMs), userId: user.id, sessionId: session.id } }); await this.prisma.session.update({ where: { id: session.id }, data: { lastActiveAt: new Date(), ipAddress: context.ipAddress, userAgent: context.userAgent } }); return { user: publicUser(user), accessToken, refreshToken, sessionId: session.id }; }
  private userWithRoles(id: string) { return this.prisma.user.findUniqueOrThrow({ where: { id }, include: { roles: { include: { role: true } } } }); }
  private deviceName(userAgent?: string) { if (!userAgent) return 'Unknown device'; if (/iPhone|iPad|Android/i.test(userAgent)) return 'Mobile device'; if (/Macintosh/i.test(userAgent)) return 'Mac'; if (/Windows/i.test(userAgent)) return 'Windows device'; return 'Browser session'; }
}
