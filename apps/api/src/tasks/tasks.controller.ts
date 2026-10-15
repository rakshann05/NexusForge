import { Body, Controller, Delete, Get, HttpCode, Param, Patch, Post, Query, UseGuards } from '@nestjs/common';
import { IsEnum, IsNumber, IsOptional, IsString, MaxLength, MinLength } from 'class-validator';
import { TaskPriority, TaskStatus } from '@prisma/client';
import { AuthenticatedUser, CurrentUser, JwtAuthGuard } from '../common/auth';
import { OrgAccessGuard, OrgPermissions } from '../organizations/org-access';
import { CurrentProject, ProjectAccess, ProjectAccessContext, ProjectAccessGuard, ProjectContext, ProjectPermissions } from '../projects/project-access';
import { TasksService } from './tasks.service';

class CreateTaskDto {
  @IsString() @MinLength(1) @MaxLength(280) title!: string;
  @IsOptional() @IsString() @MaxLength(10000) description?: string;
  @IsOptional() @IsEnum(TaskStatus) status?: TaskStatus;
  @IsOptional() @IsEnum(TaskPriority) priority?: TaskPriority;
  @IsOptional() @IsString() assigneeId?: string;
}
class UpdateTaskDto {
  @IsOptional() @IsString() @MinLength(1) @MaxLength(280) title?: string;
  @IsOptional() @IsString() @MaxLength(10000) description?: string;
  @IsOptional() @IsEnum(TaskStatus) status?: TaskStatus;
  @IsOptional() @IsEnum(TaskPriority) priority?: TaskPriority;
  @IsOptional() @IsString() assigneeId?: string;
}
class MoveTaskDto {
  @IsEnum(TaskStatus) status!: TaskStatus;
  @IsNumber() position!: number;
}
class TaskFilterDto {
  @IsOptional() @IsEnum(TaskStatus) status?: TaskStatus;
  @IsOptional() @IsEnum(TaskPriority) priority?: TaskPriority;
  @IsOptional() @IsString() assigneeId?: string;
}
class CommentDto {
  @IsString() @MinLength(1) @MaxLength(5000) body!: string;
}

// Class guards: JWT -> org membership -> project access (sets req.project/projectAccess).
// Read is the default; writes raise the bar to project:contribute per method.
@UseGuards(JwtAuthGuard, OrgAccessGuard, ProjectAccessGuard)
@OrgPermissions('organization:read')
@ProjectPermissions('project:read')
@Controller('organizations/:organizationId/projects/:projectId/tasks')
export class TasksController {
  constructor(private readonly service: TasksService) {}

  @Get()
  list(@CurrentProject() project: ProjectContext, @Query() filters: TaskFilterDto) {
    return this.service.list(project.id, filters);
  }

  @Post()
  @ProjectPermissions('project:contribute')
  create(@CurrentProject() project: ProjectContext, @CurrentUser() user: AuthenticatedUser, @Body() dto: CreateTaskDto) {
    return this.service.create(project, dto, user.sub);
  }

  @Get(':taskId')
  get(@CurrentProject() project: ProjectContext, @Param('taskId') taskId: string) {
    return this.service.get(project.id, taskId);
  }

  @Patch(':taskId')
  @ProjectPermissions('project:contribute')
  update(@CurrentProject() project: ProjectContext, @Param('taskId') taskId: string, @CurrentUser() user: AuthenticatedUser, @Body() dto: UpdateTaskDto) {
    return this.service.update(project, taskId, dto, user.sub);
  }

  @Patch(':taskId/move')
  @ProjectPermissions('project:contribute')
  move(@CurrentProject() project: ProjectContext, @Param('taskId') taskId: string, @CurrentUser() user: AuthenticatedUser, @Body() dto: MoveTaskDto) {
    return this.service.move(project, taskId, dto, user.sub);
  }

  @Delete(':taskId')
  @HttpCode(204)
  @ProjectPermissions('project:contribute')
  async remove(@CurrentProject() project: ProjectContext, @Param('taskId') taskId: string, @CurrentUser() user: AuthenticatedUser) {
    await this.service.remove(project, taskId, user.sub);
  }

  @Get(':taskId/comments')
  comments(@CurrentProject() project: ProjectContext, @Param('taskId') taskId: string) {
    return this.service.listComments(project.id, taskId);
  }

  @Post(':taskId/comments')
  @ProjectPermissions('project:contribute')
  addComment(@CurrentProject() project: ProjectContext, @Param('taskId') taskId: string, @CurrentUser() user: AuthenticatedUser, @Body() dto: CommentDto) {
    return this.service.addComment(project, taskId, dto.body, user.sub);
  }

  // Author-or-admin check lives in the service using the project-access context.
  @Delete(':taskId/comments/:commentId')
  @HttpCode(204)
  async removeComment(
    @CurrentProject() project: ProjectContext,
    @ProjectAccess() access: ProjectAccessContext,
    @Param('taskId') taskId: string,
    @Param('commentId') commentId: string,
    @CurrentUser() user: AuthenticatedUser,
  ) {
    await this.service.removeComment(project, taskId, commentId, access, user.sub);
  }
}
