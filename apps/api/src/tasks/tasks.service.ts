import { BadRequestException, ForbiddenException, Injectable, NotFoundException } from '@nestjs/common';
import { Prisma, TaskPriority, TaskStatus } from '@prisma/client';
import { AuditService } from '../audit/audit.module';
import { PrismaService } from '../common/prisma.module';
import { ProjectAccessContext, ProjectContext } from '../projects/project-access';

export type TaskFilters = { status?: TaskStatus; priority?: TaskPriority; assigneeId?: string };
export type CreateTaskInput = { title: string; description?: string; status?: TaskStatus; priority?: TaskPriority; assigneeId?: string };
export type UpdateTaskInput = { title?: string; description?: string; status?: TaskStatus; priority?: TaskPriority; assigneeId?: string | null };
export type MoveTaskInput = { status: TaskStatus; position: number };

const userSelect = { id: true, displayName: true, username: true, avatarUrl: true } as const;
const taskSelect = {
  id: true, title: true, description: true, status: true, priority: true, position: true,
  projectId: true, createdAt: true, updatedAt: true,
  assignee: { select: userSelect },
  creator: { select: userSelect },
  _count: { select: { comments: true } },
} as const;
const commentSelect = { id: true, body: true, createdAt: true, updatedAt: true, author: { select: userSelect } } as const;

type TaskRow = Prisma.TaskGetPayload<{ select: typeof taskSelect }>;

@Injectable()
export class TasksService {
  constructor(private readonly prisma: PrismaService, private readonly audit: AuditService) {}

  private view(task: TaskRow) {
    const { _count, ...rest } = task;
    return { ...rest, commentCount: _count.comments };
  }

  /** The assignee (if any) must be a member of the project. Returns the id or null. */
  private async resolveAssignee(projectId: string, assigneeId: string | null | undefined): Promise<string | null> {
    if (!assigneeId) return null;
    const member = await this.prisma.projectMember.findUnique({
      where: { userId_projectId: { userId: assigneeId, projectId } },
      select: { userId: true },
    });
    if (!member) throw new BadRequestException('The assignee must be a member of this project.');
    return assigneeId;
  }

  private async requireTask(projectId: string, taskId: string) {
    const task = await this.prisma.task.findFirst({ where: { id: taskId, projectId }, select: { id: true } });
    if (!task) throw new NotFoundException('Task not found');
    return task;
  }

  async list(projectId: string, filters: TaskFilters) {
    const where: Prisma.TaskWhereInput = { projectId };
    if (filters.status) where.status = filters.status;
    if (filters.priority) where.priority = filters.priority;
    if (filters.assigneeId) where.assigneeId = filters.assigneeId;
    const tasks = await this.prisma.task.findMany({ where, select: taskSelect, orderBy: [{ status: 'asc' }, { position: 'asc' }] });
    return tasks.map((t) => this.view(t));
  }

  async create(project: ProjectContext, dto: CreateTaskInput, creatorId: string) {
    const assigneeId = await this.resolveAssignee(project.id, dto.assigneeId);
    const task = await this.prisma.task.create({
      data: {
        title: dto.title.trim(),
        description: dto.description?.trim() || null,
        status: dto.status ?? TaskStatus.BACKLOG,
        priority: dto.priority ?? TaskPriority.MEDIUM,
        position: Date.now(),
        projectId: project.id,
        creatorId,
        assigneeId,
      },
      select: taskSelect,
    });
    await this.audit.record({ organizationId: project.organizationId, actorId: creatorId, action: 'task.created', entityType: 'Task', entityId: task.id, metadata: { projectId: project.id, title: task.title } });
    return this.view(task);
  }

  async get(projectId: string, taskId: string) {
    const task = await this.prisma.task.findFirst({ where: { id: taskId, projectId }, select: taskSelect });
    if (!task) throw new NotFoundException('Task not found');
    return this.view(task);
  }

  async update(project: ProjectContext, taskId: string, dto: UpdateTaskInput, actorId: string) {
    await this.requireTask(project.id, taskId);
    const data: Prisma.TaskUpdateInput = {};
    if (dto.title !== undefined) data.title = dto.title.trim();
    if (dto.description !== undefined) data.description = dto.description?.trim() || null;
    if (dto.status !== undefined) data.status = dto.status;
    if (dto.priority !== undefined) data.priority = dto.priority;
    if (dto.assigneeId !== undefined) {
      const assigneeId = await this.resolveAssignee(project.id, dto.assigneeId || null);
      data.assignee = assigneeId ? { connect: { id: assigneeId } } : { disconnect: true };
    }
    if (Object.keys(data).length === 0) throw new BadRequestException('No changes provided.');
    const task = await this.prisma.task.update({ where: { id: taskId }, data, select: taskSelect });
    await this.audit.record({ organizationId: project.organizationId, actorId, action: 'task.updated', entityType: 'Task', entityId: taskId, metadata: { projectId: project.id, fields: Object.keys(data) } });
    return this.view(task);
  }

  async move(project: ProjectContext, taskId: string, dto: MoveTaskInput, actorId: string) {
    await this.requireTask(project.id, taskId);
    const task = await this.prisma.task.update({ where: { id: taskId }, data: { status: dto.status, position: dto.position }, select: taskSelect });
    await this.audit.record({ organizationId: project.organizationId, actorId, action: 'task.moved', entityType: 'Task', entityId: taskId, metadata: { projectId: project.id, status: dto.status, position: dto.position } });
    return this.view(task);
  }

  async remove(project: ProjectContext, taskId: string, actorId: string) {
    await this.requireTask(project.id, taskId);
    await this.prisma.task.delete({ where: { id: taskId } });
    await this.audit.record({ organizationId: project.organizationId, actorId, action: 'task.deleted', entityType: 'Task', entityId: taskId, metadata: { projectId: project.id } });
  }

  async listComments(projectId: string, taskId: string) {
    await this.requireTask(projectId, taskId);
    const comments = await this.prisma.taskComment.findMany({ where: { taskId }, select: commentSelect, orderBy: { createdAt: 'asc' } });
    return comments;
  }

  async addComment(project: ProjectContext, taskId: string, body: string, authorId: string) {
    await this.requireTask(project.id, taskId);
    const comment = await this.prisma.taskComment.create({ data: { taskId, authorId, body: body.trim() }, select: commentSelect });
    await this.audit.record({ organizationId: project.organizationId, actorId: authorId, action: 'task.commented', entityType: 'TaskComment', entityId: comment.id, metadata: { projectId: project.id, taskId } });
    return comment;
  }

  async removeComment(project: ProjectContext, taskId: string, commentId: string, access: ProjectAccessContext, actorId: string) {
    const comment = await this.prisma.taskComment.findFirst({ where: { id: commentId, taskId, task: { projectId: project.id } }, select: { id: true, authorId: true } });
    if (!comment) throw new NotFoundException('Comment not found');
    // Only the author or a project admin may delete a comment.
    if (comment.authorId !== actorId && !access.isAdmin) throw new ForbiddenException('You do not have permission to delete this comment.');
    await this.prisma.taskComment.delete({ where: { id: commentId } });
    await this.audit.record({ organizationId: project.organizationId, actorId, action: 'task.comment_deleted', entityType: 'TaskComment', entityId: commentId, metadata: { projectId: project.id, taskId } });
  }
}
