import { ConflictException, Injectable, UnauthorizedException } from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import * as bcrypt from 'bcrypt';
import { PrismaService } from '../common/prisma.module';

@Injectable()
export class AuthService {
  constructor(private readonly prisma: PrismaService, private readonly jwt: JwtService) {}
  async register(input: { email: string; displayName: string; password: string }) {
    const email = input.email.toLowerCase();
    if (await this.prisma.user.findUnique({ where: { email } })) throw new ConflictException('Email is already registered');
    const user = await this.prisma.user.create({ data: { email, displayName: input.displayName, passwordHash: await bcrypt.hash(input.password, 12) } });
    return this.issueTokens(user.id, user.email, user.displayName);
  }
  async login(input: { email: string; password: string }) {
    const user = await this.prisma.user.findUnique({ where: { email: input.email.toLowerCase() } });
    if (!user || !(await bcrypt.compare(input.password, user.passwordHash))) throw new UnauthorizedException('Invalid email or password');
    return this.issueTokens(user.id, user.email, user.displayName);
  }
  private async issueTokens(id: string, email: string, displayName: string) {
    const payload = { sub: id, email, displayName };
    const accessToken = await this.jwt.signAsync(payload, { secret: process.env.JWT_ACCESS_SECRET, expiresIn: (process.env.JWT_ACCESS_TTL ?? '15m') as never });
    const refreshToken = await this.jwt.signAsync(payload, { secret: process.env.JWT_REFRESH_SECRET, expiresIn: (process.env.JWT_REFRESH_TTL ?? '7d') as never });
    await this.prisma.refreshToken.create({ data: { tokenHash: await bcrypt.hash(refreshToken, 12), expiresAt: new Date(Date.now() + 7 * 86400000), userId: id } });
    return { user: { id, email, displayName }, accessToken, refreshToken };
  }
}
