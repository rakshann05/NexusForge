import { BadRequestException, Body, Controller, Delete, Get, HttpCode, Param, Patch, Post, Req, Res, UnauthorizedException, UseGuards } from '@nestjs/common';
import { Throttle } from '@nestjs/throttler';
import { IsEmail, IsIn, IsOptional, IsString, Matches, MaxLength, MinLength } from 'class-validator';
import type { Request, Response } from 'express';
import { AuthenticatedUser, CurrentUser, JwtAuthGuard } from '../common/auth';
import { AuthService } from './auth.service';

// Credential-facing endpoints get a stricter limit than the global 100/60s
// guard so password guessing and account-creation abuse are slowed without
// ever permanently locking a user out (the window rolls forward continuously).
const authThrottle = { default: { limit: 10, ttl: 60_000 } };

const passwordPolicy = /^(?=.*[a-z])(?=.*[A-Z])(?=.*\d)(?=.*[^A-Za-z0-9]).{12,128}$/;
class RegisterDto { @IsEmail() email!: string; @Matches(/^[a-zA-Z0-9_]{3,32}$/) username!: string; @IsString() @MinLength(2) @MaxLength(80) displayName!: string; @Matches(passwordPolicy, { message: 'Password must be 12+ characters and include upper, lower, number, and symbol' }) password!: string; @IsString() confirmPassword!: string; }
class LoginDto { @IsString() @MinLength(3) identifier!: string; @IsString() password!: string; }
class RefreshDto { @IsOptional() @IsString() refreshToken?: string; }
class UpdateProfileDto { @IsOptional() @IsString() @MinLength(2) @MaxLength(80) displayName?: string; @IsOptional() @IsString() @MaxLength(500) bio?: string; @IsOptional() @IsString() @MaxLength(80) timezone?: string; @IsOptional() @IsString() @MaxLength(12) language?: string; @IsOptional() @IsIn(['light', 'dark', 'system']) theme?: string; @IsOptional() @IsString() @MaxLength(2048) avatarUrl?: string; }

@Controller('auth')
export class AuthController {
  constructor(private readonly auth: AuthService) {}
  @Throttle(authThrottle) @Post('register') async register(@Body() input: RegisterDto, @Req() request: Request, @Res({ passthrough: true }) response: Response) { if (input.password !== input.confirmPassword) throw new BadRequestException('Password confirmation does not match'); return this.respond(response, await this.auth.register(input, this.context(request))); }
  @Throttle(authThrottle) @Post('login') async login(@Body() input: LoginDto, @Req() request: Request, @Res({ passthrough: true }) response: Response) { return this.respond(response, await this.auth.login(input.identifier, input.password, this.context(request))); }
  @Post('refresh') @HttpCode(200) async refresh(@Body() input: RefreshDto, @Req() request: Request, @Res({ passthrough: true }) response: Response) { const token = input.refreshToken ?? this.cookie(request, 'nexusforge_refresh'); if (!token) throw new UnauthorizedException('Refresh token is required'); return this.respond(response, await this.auth.refresh(token, this.context(request))); }
  @UseGuards(JwtAuthGuard) @Post('logout') @HttpCode(204) async logout(@CurrentUser() user: AuthenticatedUser, @Res({ passthrough: true }) response: Response) { await this.auth.logout(user); response.clearCookie('nexusforge_refresh', this.cookieOptions()); }
  @UseGuards(JwtAuthGuard) @Post('logout-all') @HttpCode(204) async logoutAll(@CurrentUser() user: AuthenticatedUser, @Res({ passthrough: true }) response: Response) { await this.auth.logoutAll(user.sub); response.clearCookie('nexusforge_refresh', this.cookieOptions()); }
  @UseGuards(JwtAuthGuard) @Get('me') me(@CurrentUser() user: AuthenticatedUser) { return this.auth.profile(user.sub); }
  @UseGuards(JwtAuthGuard) @Patch('me') update(@CurrentUser() user: AuthenticatedUser, @Body() input: UpdateProfileDto) { return this.auth.updateProfile(user.sub, input); }
  @UseGuards(JwtAuthGuard) @Get('sessions') sessions(@CurrentUser() user: AuthenticatedUser) { return this.auth.sessions(user); }
  @UseGuards(JwtAuthGuard) @Delete('sessions/:sessionId') @HttpCode(204) async revokeSession(@CurrentUser() user: AuthenticatedUser, @Param('sessionId') sessionId: string, @Res({ passthrough: true }) response: Response) { await this.auth.revokeSession(user.sub, sessionId); if (sessionId === user.sid) response.clearCookie('nexusforge_refresh', this.cookieOptions()); }
  @UseGuards(JwtAuthGuard) @Get('roles') roles(@CurrentUser() user: AuthenticatedUser) { return this.auth.roles(user.sub); }
  private respond(response: Response, result: Awaited<ReturnType<AuthService['login']>>) { response.cookie('nexusforge_refresh', result.refreshToken, this.cookieOptions()); const { refreshToken, ...body } = result; return body; }
  private context(request: Request) { return { ipAddress: request.ip, userAgent: request.get('user-agent') }; }
  private cookie(request: Request, key: string) { return request.headers.cookie?.split(';').map((item: string) => item.trim().split('=')).find((parts: string[]) => parts[0] === key)?.slice(1).join('='); }
  private cookieOptions() { return { httpOnly: true, secure: process.env.NODE_ENV === 'production', sameSite: 'lax' as const, path: '/api/auth', maxAge: 7 * 24 * 60 * 60 * 1000 }; }
}
