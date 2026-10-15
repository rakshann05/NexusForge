import { BadRequestException, ForbiddenException, NotFoundException } from '@nestjs/common';
import { TaskStatus } from '@prisma/client';
import { TasksService } from './tasks.service';

const audit = () => ({ record: jest.fn().mockResolvedValue(undefined) });
const project = { id: 'p1', name: 'P', description: null, organizationId: 'orgA', archivedAt: null, createdAt: new Date(), updatedAt: new Date(), organization: { id: 'orgA', name: 'A' }, memberCount: 2 } as never;
const taskRow = {
  id: 't1', title: 'T', description: null, status: 'BACKLOG', priority: 'MEDIUM', position: 1, projectId: 'p1',
  createdAt: new Date(), updatedAt: new Date(), assignee: null, creator: { id: 'u1' }, _count: { comments: 0 },
};
const adminAccess = { membershipRole: 'ADMIN', isAdmin: true, isContributor: true, effectiveRole: 'ADMIN' } as never;
const memberAccess = { membershipRole: 'MEMBER', isAdmin: false, isContributor: true, effectiveRole: 'MEMBER' } as never;

describe('TasksService', () => {
  it('creates a task and audits it', async () => {
    const a = audit();
    const prisma = { task: { create: jest.fn().mockResolvedValue(taskRow) } };
    const service = new TasksService(prisma as never, a as never);
    const result = await service.create(project, { title: 'T' }, 'u1');
    expect(result.id).toBe('t1');
    expect(result).not.toHaveProperty('_count');
    expect(result.commentCount).toBe(0);
    expect(a.record).toHaveBeenCalledWith(expect.objectContaining({ action: 'task.created' }));
  });

  it('rejects assigning a user who is not a project member (400)', async () => {
    const prisma = { projectMember: { findUnique: jest.fn().mockResolvedValue(null) } };
    const service = new TasksService(prisma as never, audit() as never);
    await expect(service.create(project, { title: 'T', assigneeId: 'outsider' }, 'u1')).rejects.toBeInstanceOf(BadRequestException);
  });

  it('assigns a task to a project member', async () => {
    const prisma = {
      projectMember: { findUnique: jest.fn().mockResolvedValue({ userId: 'u2' }) },
      task: { create: jest.fn().mockResolvedValue({ ...taskRow, assignee: { id: 'u2' } }) },
    };
    const service = new TasksService(prisma as never, audit() as never);
    const result = await service.create(project, { title: 'T', assigneeId: 'u2' }, 'u1');
    expect(result.assignee).toEqual({ id: 'u2' });
    expect(prisma.task.create).toHaveBeenCalledWith(expect.objectContaining({ data: expect.objectContaining({ assigneeId: 'u2' }) }));
  });

  it('moves a task (status + position) and audits it', async () => {
    const a = audit();
    const prisma = { task: { findFirst: jest.fn().mockResolvedValue({ id: 't1' }), update: jest.fn().mockResolvedValue(taskRow) } };
    const service = new TasksService(prisma as never, a as never);
    await service.move(project, 't1', { status: TaskStatus.DONE, position: 5 }, 'u1');
    expect(prisma.task.update).toHaveBeenCalledWith(expect.objectContaining({ data: { status: 'DONE', position: 5 } }));
    expect(a.record).toHaveBeenCalledWith(expect.objectContaining({ action: 'task.moved' }));
  });

  it('404s when moving a task that is not in the project', async () => {
    const prisma = { task: { findFirst: jest.fn().mockResolvedValue(null) } };
    const service = new TasksService(prisma as never, audit() as never);
    await expect(service.move(project, 'ghost', { status: TaskStatus.DONE, position: 5 }, 'u1')).rejects.toBeInstanceOf(NotFoundException);
  });

  it('lets a comment author delete their own comment', async () => {
    const a = audit();
    const prisma = { taskComment: { findFirst: jest.fn().mockResolvedValue({ id: 'c1', authorId: 'u1' }), delete: jest.fn().mockResolvedValue({}) } };
    const service = new TasksService(prisma as never, a as never);
    await expect(service.removeComment(project, 't1', 'c1', memberAccess, 'u1')).resolves.toBeUndefined();
    expect(a.record).toHaveBeenCalledWith(expect.objectContaining({ action: 'task.comment_deleted' }));
  });

  it('forbids a non-admin from deleting someone else’s comment', async () => {
    const prisma = { taskComment: { findFirst: jest.fn().mockResolvedValue({ id: 'c1', authorId: 'other' }) } };
    const service = new TasksService(prisma as never, audit() as never);
    await expect(service.removeComment(project, 't1', 'c1', memberAccess, 'u1')).rejects.toBeInstanceOf(ForbiddenException);
  });

  it('lets a project admin delete another member’s comment', async () => {
    const prisma = { taskComment: { findFirst: jest.fn().mockResolvedValue({ id: 'c1', authorId: 'other' }), delete: jest.fn().mockResolvedValue({}) } };
    const service = new TasksService(prisma as never, audit() as never);
    await expect(service.removeComment(project, 't1', 'c1', adminAccess, 'admin1')).resolves.toBeUndefined();
  });
});
