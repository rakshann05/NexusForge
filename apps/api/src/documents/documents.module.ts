import { Body, Controller, Get, Injectable, Module, Param, Post, UseGuards } from '@nestjs/common';
import { IsString, MaxLength, MinLength } from 'class-validator';
import { AuditService } from '../audit/audit.module';
import { AuthenticatedUser, CurrentUser, JwtAuthGuard } from '../common/auth';
import { PrismaService } from '../common/prisma.module';
import { OrganizationsModule, OrganizationsService } from '../organizations/organizations.module';

class CreateDocumentDto { @IsString() @MinLength(1) @MaxLength(200) title!: string; @IsString() @MaxLength(100000) content!: string; }
@Injectable()
export class DocumentsService {
  constructor(private readonly prisma: PrismaService, private readonly organizations: OrganizationsService, private readonly audit: AuditService) {}
  async list(organizationId: string, userId: string) { await this.organizations.getMember(organizationId, userId); return this.prisma.document.findMany({ where: { organizationId }, select: { id: true, title: true, createdAt: true, updatedAt: true }, orderBy: { updatedAt: 'desc' } }); }
  async create(organizationId: string, userId: string, dto: CreateDocumentDto) { await this.organizations.getMember(organizationId, userId); const document = await this.prisma.document.create({ data: { ...dto, organizationId } }); await this.audit.record({ organizationId, actorId: userId, action: 'document.created', entityType: 'Document', entityId: document.id }); return document; }
}
@UseGuards(JwtAuthGuard)
@Controller('organizations/:organizationId/documents')
export class DocumentsController {
  constructor(private readonly service: DocumentsService) {}
  @Get() list(@CurrentUser() u: AuthenticatedUser, @Param('organizationId') id: string) { return this.service.list(id, u.sub); }
  @Post() create(@CurrentUser() u: AuthenticatedUser, @Param('organizationId') id: string, @Body() dto: CreateDocumentDto) { return this.service.create(id, u.sub, dto); }
}
@Module({ imports: [OrganizationsModule], controllers: [DocumentsController], providers: [DocumentsService] }) export class DocumentsModule {}
