import { Body, ConflictException, Controller, Get, Injectable, Module, NotFoundException, Param, Post, UseGuards } from '@nestjs/common';
import { IsOptional, IsString, Matches, MaxLength, MinLength } from 'class-validator';
import { AuditService } from '../audit/audit.module';
import { AuthenticatedUser, CurrentUser, JwtAuthGuard } from '../common/auth';
import { PrismaService } from '../common/prisma.module';

class CreateOrganizationDto { @IsString() @MinLength(2) @MaxLength(80) name!: string; @IsOptional() @Matches(/^[a-z0-9-]{3,64}$/) slug?: string; }
const toSlug = (value: string) => value.toLowerCase().trim().replace(/[^a-z0-9]+/g, '-').replace(/(^-|-$)/g, '');

@Injectable()
export class OrganizationsService {
  constructor(private readonly prisma: PrismaService, private readonly audit: AuditService) {}
  list(userId: string) { return this.prisma.organization.findMany({ where: { members: { some: { userId } } }, include: { _count: { select: { members: true, projects: true } } }, orderBy: { name: 'asc' } }); }
  async create(userId: string, dto: CreateOrganizationDto) {
    const slug = dto.slug ?? toSlug(dto.name);
    if (!slug) throw new ConflictException('A valid organization name or slug is required');
    try {
      const organization = await this.prisma.organization.create({ data: { name: dto.name.trim(), slug, members: { create: { userId, role: 'OWNER' } } } });
      await this.audit.record({ actorId: userId, organizationId: organization.id, action: 'organization.created', entityType: 'Organization', entityId: organization.id });
      return organization;
    } catch (error: unknown) { if ((error as { code?: string }).code === 'P2002') throw new ConflictException('That organization slug is already in use'); throw error; }
  }
  async getMember(organizationId: string, userId: string) {
    const membership = await this.prisma.organizationMember.findUnique({ where: { userId_organizationId: { userId, organizationId } } });
    if (!membership) throw new NotFoundException('Organization not found');
    return membership;
  }
}

@UseGuards(JwtAuthGuard)
@Controller('organizations')
export class OrganizationsController {
  constructor(private readonly service: OrganizationsService) {}
  @Get() list(@CurrentUser() user: AuthenticatedUser) { return this.service.list(user.sub); }
  @Post() create(@CurrentUser() user: AuthenticatedUser, @Body() dto: CreateOrganizationDto) { return this.service.create(user.sub, dto); }
  @Get(':organizationId') async get(@CurrentUser() user: AuthenticatedUser, @Param('organizationId') id: string) { return this.service.getMember(id, user.sub); }
}

@Module({ controllers: [OrganizationsController], providers: [OrganizationsService], exports: [OrganizationsService] })
export class OrganizationsModule {}
