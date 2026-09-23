import { Body, Controller, Delete, Get, HttpCode, Param, Patch, Post, UseGuards } from '@nestjs/common';
import { IsEnum, IsOptional, IsString, Matches, MaxLength, MinLength } from 'class-validator';
import { OrganizationRole } from '@prisma/client';
import { AuthenticatedUser, CurrentUser, JwtAuthGuard } from '../common/auth';
import { OrgAccessGuard, OrgMembership, OrgMembershipContext, OrgPermissions } from './org-access';
import { OrganizationsService } from './organizations.service';

class CreateOrganizationDto {
  @IsString() @MinLength(2) @MaxLength(80) name!: string;
  @IsOptional() @IsString() @MaxLength(500) description?: string;
  @IsOptional() @Matches(/^[a-z0-9-]{3,64}$/) slug?: string;
}
class UpdateOrganizationDto {
  @IsOptional() @IsString() @MinLength(2) @MaxLength(80) name?: string;
  @IsOptional() @IsString() @MaxLength(500) description?: string;
}
class AddMemberDto {
  @IsString() @MinLength(3) @MaxLength(320) identifier!: string;
  @IsOptional() @IsEnum(OrganizationRole) role?: OrganizationRole;
}
class ChangeRoleDto {
  @IsEnum(OrganizationRole) role!: OrganizationRole;
}

@UseGuards(JwtAuthGuard)
@Controller('organizations')
export class OrganizationsController {
  constructor(private readonly service: OrganizationsService) {}

  @Get()
  list(@CurrentUser() user: AuthenticatedUser) {
    return this.service.list(user.sub);
  }

  @Post()
  create(@CurrentUser() user: AuthenticatedUser, @Body() dto: CreateOrganizationDto) {
    return this.service.create(user.sub, dto);
  }

  @Get(':organizationId')
  @UseGuards(OrgAccessGuard)
  @OrgPermissions('organization:read')
  get(@Param('organizationId') organizationId: string, @OrgMembership() membership: OrgMembershipContext) {
    return this.service.get(organizationId, membership);
  }

  @Patch(':organizationId')
  @UseGuards(OrgAccessGuard)
  @OrgPermissions('organization:update')
  update(@Param('organizationId') organizationId: string, @Body() dto: UpdateOrganizationDto, @OrgMembership() membership: OrgMembershipContext) {
    return this.service.update(organizationId, dto, membership);
  }

  @Get(':organizationId/members')
  @UseGuards(OrgAccessGuard)
  @OrgPermissions('organization:read')
  members(@Param('organizationId') organizationId: string) {
    return this.service.listMembers(organizationId);
  }

  @Post(':organizationId/members')
  @UseGuards(OrgAccessGuard)
  @OrgPermissions('organization:manage_members')
  addMember(@Param('organizationId') organizationId: string, @Body() dto: AddMemberDto, @OrgMembership() membership: OrgMembershipContext) {
    return this.service.addMember(organizationId, dto, membership);
  }

  @Patch(':organizationId/members/:userId/role')
  @UseGuards(OrgAccessGuard)
  @OrgPermissions('organization:manage_members')
  changeRole(
    @Param('organizationId') organizationId: string,
    @Param('userId') userId: string,
    @Body() dto: ChangeRoleDto,
    @OrgMembership() membership: OrgMembershipContext,
  ) {
    return this.service.changeMemberRole(organizationId, userId, dto.role, membership);
  }

  // Gated only by membership so a member can leave (self-remove); removing
  // others requires manage_members, enforced in the service.
  @Delete(':organizationId/members/:userId')
  @HttpCode(204)
  @UseGuards(OrgAccessGuard)
  @OrgPermissions('organization:read')
  async removeMember(@Param('organizationId') organizationId: string, @Param('userId') userId: string, @OrgMembership() membership: OrgMembershipContext) {
    await this.service.removeMember(organizationId, userId, membership);
  }
}
