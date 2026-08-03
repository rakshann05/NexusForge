import { Body, Controller, Get, Injectable, Module, Param, Patch, Post, UseGuards } from '@nestjs/common';
import { IsEnum, IsOptional, IsString, MaxLength, MinLength, IsNumber } from 'class-validator';
import { TaskPriority, TaskStatus } from '@prisma/client';
import { AuditService } from '../audit/audit.module';
import { AuthenticatedUser, CurrentUser, JwtAuthGuard } from '../common/auth';
import { PrismaService } from '../common/prisma.module';

class CreateTaskDto { @IsString() @MinLength(1) @MaxLength(280) title!: string; @IsOptional() @IsString() @MaxLength(10000) description?: string; @IsOptional() @IsEnum(TaskPriority) priority?: TaskPriority; @IsOptional() @IsEnum(TaskStatus) status?: TaskStatus; @IsOptional() @IsString() assigneeId?: string; }
class MoveTaskDto { @IsEnum(TaskStatus) status!: TaskStatus; @IsNumber() position!: number; }
@Injectable()
export class TasksService {
  constructor(private readonly prisma: PrismaService, private readonly audit: AuditService) {}
  private async projectForUser(projectId: string, userId: string) { return this.prisma.project.findFirstOrThrow({ where: { id: projectId, organization: { members: { some: { userId } } } } }); }
  async list(projectId: string, userId: string) { await this.projectForUser(projectId, userId); return this.prisma.task.findMany({ where: { projectId }, include: { assignee: { select: { id: true, displayName: true, avatarUrl: true } } }, orderBy: [{ status: 'asc' }, { position: 'asc' }] }); }
  async create(projectId: string, userId: string, dto: CreateTaskDto) { const project = await this.projectForUser(projectId, userId); const task = await this.prisma.task.create({ data: { ...dto, projectId, creatorId: userId, position: Date.now() } }); await this.audit.record({ organizationId: project.organizationId, actorId: userId, action: 'task.created', entityType: 'Task', entityId: task.id }); return task; }
  async move(projectId: string, taskId: string, userId: string, dto: MoveTaskDto) { const project = await this.projectForUser(projectId, userId); await this.prisma.task.findFirstOrThrow({ where: { id: taskId, projectId } }); const task = await this.prisma.task.update({ where: { id: taskId }, data: dto }); await this.audit.record({ organizationId: project.organizationId, actorId: userId, action: 'task.moved', entityType: 'Task', entityId: task.id, metadata: { status: dto.status, position: dto.position } }); return task; }
}
@UseGuards(JwtAuthGuard)
@Controller('projects/:projectId/tasks')
export class TasksController {
  constructor(private readonly service: TasksService) {}
  @Get() list(@CurrentUser() u: AuthenticatedUser, @Param('projectId') p: string) { return this.service.list(p, u.sub); }
  @Post() create(@CurrentUser() u: AuthenticatedUser, @Param('projectId') p: string, @Body() dto: CreateTaskDto) { return this.service.create(p, u.sub, dto); }
  @Patch(':taskId/move') move(@CurrentUser() u: AuthenticatedUser, @Param('projectId') p: string, @Param('taskId') t: string, @Body() dto: MoveTaskDto) { return this.service.move(p, t, u.sub, dto); }
}
@Module({ controllers: [TasksController], providers: [TasksService] }) export class TasksModule {}
