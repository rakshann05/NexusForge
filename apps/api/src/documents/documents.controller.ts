import { Body, Controller, Delete, Get, HttpCode, Param, Patch, Post, Query, UseGuards } from '@nestjs/common';
import { IsOptional, IsString, MaxLength, MinLength } from 'class-validator';
import { AuthenticatedUser, CurrentUser, JwtAuthGuard } from '../common/auth';
import { OrgAccessGuard, OrgPermissions } from '../organizations/org-access';
import { DocumentsService } from './documents.service';

class CreateDocumentDto {
  @IsString() @MinLength(1) @MaxLength(200) title!: string;
  @IsOptional() @IsString() @MaxLength(100000) content?: string;
}
class UpdateDocumentDto {
  @IsOptional() @IsString() @MinLength(1) @MaxLength(200) title?: string;
  @IsOptional() @IsString() @MaxLength(100000) content?: string;
  @IsOptional() @IsString() expectedUpdatedAt?: string;
}
class SearchDto {
  @IsOptional() @IsString() @MaxLength(200) q?: string;
}

@UseGuards(JwtAuthGuard, OrgAccessGuard)
@Controller('organizations/:organizationId/documents')
export class DocumentsController {
  constructor(private readonly service: DocumentsService) {}

  @Get()
  @OrgPermissions('organization:read')
  list(@Param('organizationId') organizationId: string, @Query() query: SearchDto) {
    return this.service.list(organizationId, query.q?.trim() || undefined);
  }

  @Post()
  @OrgPermissions('organization:contribute')
  create(@Param('organizationId') organizationId: string, @CurrentUser() user: AuthenticatedUser, @Body() dto: CreateDocumentDto) {
    return this.service.create(organizationId, dto, user.sub);
  }

  @Get(':documentId')
  @OrgPermissions('organization:read')
  get(@Param('organizationId') organizationId: string, @Param('documentId') documentId: string) {
    return this.service.get(organizationId, documentId);
  }

  @Patch(':documentId')
  @OrgPermissions('organization:contribute')
  update(@Param('organizationId') organizationId: string, @Param('documentId') documentId: string, @CurrentUser() user: AuthenticatedUser, @Body() dto: UpdateDocumentDto) {
    return this.service.update(organizationId, documentId, dto, user.sub);
  }

  @Delete(':documentId')
  @HttpCode(204)
  @OrgPermissions('organization:contribute')
  async remove(@Param('organizationId') organizationId: string, @Param('documentId') documentId: string, @CurrentUser() user: AuthenticatedUser) {
    await this.service.remove(organizationId, documentId, user.sub);
  }

  @Get(':documentId/revisions')
  @OrgPermissions('organization:read')
  revisions(@Param('organizationId') organizationId: string, @Param('documentId') documentId: string) {
    return this.service.listRevisions(organizationId, documentId);
  }

  @Get(':documentId/revisions/:revisionId')
  @OrgPermissions('organization:read')
  revision(@Param('organizationId') organizationId: string, @Param('documentId') documentId: string, @Param('revisionId') revisionId: string) {
    return this.service.getRevision(organizationId, documentId, revisionId);
  }

  @Post(':documentId/revisions/:revisionId/restore')
  @OrgPermissions('organization:contribute')
  restore(@Param('organizationId') organizationId: string, @Param('documentId') documentId: string, @Param('revisionId') revisionId: string, @CurrentUser() user: AuthenticatedUser) {
    return this.service.restore(organizationId, documentId, revisionId, user.sub);
  }
}
