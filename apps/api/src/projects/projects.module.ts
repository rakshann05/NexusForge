import { Body, Controller, Get, Injectable, Module, Param, Post, UseGuards } from '@nestjs/common';
import { IsOptional, IsString, Matches, MaxLength, MinLength } from 'class-validator';
import { AuditService } from '../audit/audit.module';
import { AuthenticatedUser, CurrentUser, JwtAuthGuard } from '../common/auth';
import { PrismaService } from '../common/prisma.module';
import { OrganizationsModule, OrganizationsService } from '../organizations/organizations.module';

class CreateProjectDto { @IsString() @MinLength(2) @MaxLength(120) name!: string; @Matches(/^[A-Z][A-Z0-9]{1,9}$/) key!: string; @IsOptional() @IsString() @MaxLength(2000) description?: string; }
@Injectable()
export class ProjectsService {
  constructor(private readonly prisma: PrismaService, private readonly organizations: OrganizationsService, private readonly audit: AuditService) {}
  async list(organizationId: string, userId: string) { await this.organizations.getMember(organizationId, userId); return this.prisma.project.findMany({ where: { organizationId }, include: { _count: { select: { tasks: true } } }, orderBy: { updatedAt: 'desc' } }); }
  async create(organizationId: string, userId: string, dto: CreateProjectDto) {
    await this.organizations.getMember(organizationId, userId);
    const project = await this.prisma.project.create({ data: { ...dto, key: dto.key.toUpperCase(), organizationId, members: { create: { userId, role: 'ADMIN' } } } });
    await this.audit.record({ organizationId, actorId: userId, action: 'project.created', entityType: 'Project', entityId: project.id });
    return project;
  }
}
@UseGuards(JwtAuthGuard)
@Controller('organizations/:organizationId/projects')
export class ProjectsController {
  constructor(private readonly service: ProjectsService) {}
  @Get() list(@CurrentUser() user: AuthenticatedUser, @Param('organizationId') id: string) { return this.service.list(id, user.sub); }
  @Post() create(@CurrentUser() user: AuthenticatedUser, @Param('organizationId') id: string, @Body() dto: CreateProjectDto) { return this.service.create(id, user.sub, dto); }
}
@Module({ imports: [OrganizationsModule], controllers: [ProjectsController], providers: [ProjectsService] })
export class ProjectsModule {}
