import { Body, Controller, Delete, Get, HttpCode, Param, Patch, Post, UseGuards } from '@nestjs/common';
import { IsEnum, IsOptional, IsString, MaxLength, MinLength } from 'class-validator';
import { ProjectRole } from '@prisma/client';
import { AuthenticatedUser, CurrentUser, JwtAuthGuard } from '../common/auth';
import { OrgAccessGuard, OrgMembership, OrgMembershipContext, OrgPermissions } from '../organizations/org-access';
import {
  CurrentProject,
  ProjectAccess,
  ProjectAccessContext,
  ProjectAccessGuard,
  ProjectContext,
  ProjectPermissions,
} from './project-access';
import { ProjectsService } from './projects.service';

class CreateProjectDto {
  @IsString() @MinLength(2) @MaxLength(120) name!: string;
  @IsOptional() @IsString() @MaxLength(2000) description?: string;
}
class UpdateProjectDto {
  @IsOptional() @IsString() @MinLength(2) @MaxLength(120) name?: string;
  @IsOptional() @IsString() @MaxLength(2000) description?: string;
}
class AddProjectMemberDto {
  @IsString() @MinLength(3) @MaxLength(320) identifier!: string;
  @IsOptional() @IsEnum(ProjectRole) role?: ProjectRole;
}
class ChangeProjectRoleDto {
  @IsEnum(ProjectRole) role!: ProjectRole;
}

// Class guards run first (JWT -> org access), so req.orgMembership is set before
// any method-level ProjectAccessGuard. @OrgPermissions('organization:read')
// requires the caller to be a member of the organization in the route.
@UseGuards(JwtAuthGuard, OrgAccessGuard)
@OrgPermissions('organization:read')
@Controller('organizations/:organizationId/projects')
export class ProjectsController {
  constructor(private readonly service: ProjectsService) {}

  @Get()
  list(@Param('organizationId') organizationId: string, @CurrentUser() user: AuthenticatedUser) {
    return this.service.list(organizationId, user.sub);
  }

  @Post()
  create(@Param('organizationId') organizationId: string, @OrgMembership() membership: OrgMembershipContext, @Body() dto: CreateProjectDto) {
    return this.service.create(organizationId, membership, dto);
  }

  @Get(':projectId')
  @UseGuards(ProjectAccessGuard)
  @ProjectPermissions('project:read')
  get(@CurrentProject() project: ProjectContext, @ProjectAccess() access: ProjectAccessContext) {
    return this.service.get(project, access);
  }

  @Patch(':projectId')
  @UseGuards(ProjectAccessGuard)
  @ProjectPermissions('project:update')
  update(@CurrentProject() project: ProjectContext, @ProjectAccess() access: ProjectAccessContext, @CurrentUser() user: AuthenticatedUser, @Body() dto: UpdateProjectDto) {
    return this.service.update(project, dto, access, user.sub);
  }

  @Delete(':projectId')
  @HttpCode(204)
  @UseGuards(ProjectAccessGuard)
  @ProjectPermissions('project:delete')
  async archive(@CurrentProject() project: ProjectContext, @CurrentUser() user: AuthenticatedUser) {
    await this.service.archive(project, user.sub);
  }

  @Get(':projectId/members')
  @UseGuards(ProjectAccessGuard)
  @ProjectPermissions('project:read')
  members(@CurrentProject() project: ProjectContext) {
    return this.service.listMembers(project.id);
  }

  @Post(':projectId/members')
  @UseGuards(ProjectAccessGuard)
  @ProjectPermissions('project:manage_members')
  addMember(@CurrentProject() project: ProjectContext, @CurrentUser() user: AuthenticatedUser, @Body() dto: AddProjectMemberDto) {
    return this.service.addMember(project, dto, user.sub);
  }

  @Patch(':projectId/members/:userId/role')
  @UseGuards(ProjectAccessGuard)
  @ProjectPermissions('project:manage_members')
  changeRole(@CurrentProject() project: ProjectContext, @Param('userId') userId: string, @CurrentUser() user: AuthenticatedUser, @Body() dto: ChangeProjectRoleDto) {
    return this.service.changeMemberRole(project, userId, dto.role, user.sub);
  }

  // Gated only by membership so a member can leave; removing others needs admin
  // (enforced in the service using the effective project-access context).
  @Delete(':projectId/members/:userId')
  @HttpCode(204)
  @UseGuards(ProjectAccessGuard)
  @ProjectPermissions('project:read')
  async removeMember(@CurrentProject() project: ProjectContext, @ProjectAccess() access: ProjectAccessContext, @Param('userId') userId: string, @CurrentUser() user: AuthenticatedUser) {
    await this.service.removeMember(project, userId, access, user.sub);
  }
}
