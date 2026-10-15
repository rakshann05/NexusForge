/**
 * Typed wrappers for task endpoints (nested under a project). Authorization is
 * enforced server-side; the client gates write controls by the caller's
 * effective project role for UX only.
 */
import { apiRequest } from './api';
import type { ProjectRole } from './projects';

export type TaskStatus = 'BACKLOG' | 'TODO' | 'IN_PROGRESS' | 'IN_REVIEW' | 'DONE';
export type TaskPriority = 'LOW' | 'MEDIUM' | 'HIGH' | 'URGENT';

export const TASK_STATUSES: TaskStatus[] = ['BACKLOG', 'TODO', 'IN_PROGRESS', 'IN_REVIEW', 'DONE'];
export const TASK_PRIORITIES: TaskPriority[] = ['LOW', 'MEDIUM', 'HIGH', 'URGENT'];
export const STATUS_LABEL: Record<TaskStatus, string> = {
  BACKLOG: 'Backlog',
  TODO: 'To do',
  IN_PROGRESS: 'In progress',
  IN_REVIEW: 'In review',
  DONE: 'Done',
};

export interface TaskUser {
  id: string;
  displayName: string;
  username: string;
  avatarUrl: string | null;
}

export interface Task {
  id: string;
  title: string;
  description: string | null;
  status: TaskStatus;
  priority: TaskPriority;
  position: number;
  projectId: string;
  assignee: TaskUser | null;
  creator: TaskUser;
  commentCount: number;
  createdAt: string;
  updatedAt: string;
}

export interface TaskComment {
  id: string;
  body: string;
  createdAt: string;
  updatedAt: string;
  author: TaskUser;
}

const base = (organizationId: string, projectId: string) =>
  `/organizations/${encodeURIComponent(organizationId)}/projects/${encodeURIComponent(projectId)}/tasks`;

export const listTasks = (
  organizationId: string,
  projectId: string,
  filters: { status?: TaskStatus; priority?: TaskPriority; assigneeId?: string } = {},
) => {
  const q = new URLSearchParams();
  if (filters.status) q.set('status', filters.status);
  if (filters.priority) q.set('priority', filters.priority);
  if (filters.assigneeId) q.set('assigneeId', filters.assigneeId);
  const query = q.toString();
  return apiRequest<Task[]>(`${base(organizationId, projectId)}${query ? `?${query}` : ''}`);
};

export const createTask = (
  organizationId: string,
  projectId: string,
  input: { title: string; description?: string; status?: TaskStatus; priority?: TaskPriority; assigneeId?: string },
) => apiRequest<Task>(base(organizationId, projectId), { method: 'POST', body: input });

export const getTask = (organizationId: string, projectId: string, taskId: string) =>
  apiRequest<Task>(`${base(organizationId, projectId)}/${encodeURIComponent(taskId)}`);

export const updateTask = (
  organizationId: string,
  projectId: string,
  taskId: string,
  patch: { title?: string; description?: string; status?: TaskStatus; priority?: TaskPriority; assigneeId?: string },
) => apiRequest<Task>(`${base(organizationId, projectId)}/${encodeURIComponent(taskId)}`, { method: 'PATCH', body: patch });

export const moveTask = (organizationId: string, projectId: string, taskId: string, status: TaskStatus, position: number) =>
  apiRequest<Task>(`${base(organizationId, projectId)}/${encodeURIComponent(taskId)}/move`, { method: 'PATCH', body: { status, position } });

export const deleteTask = (organizationId: string, projectId: string, taskId: string) =>
  apiRequest<null>(`${base(organizationId, projectId)}/${encodeURIComponent(taskId)}`, { method: 'DELETE' });

export const listTaskComments = (organizationId: string, projectId: string, taskId: string) =>
  apiRequest<TaskComment[]>(`${base(organizationId, projectId)}/${encodeURIComponent(taskId)}/comments`);

export const addTaskComment = (organizationId: string, projectId: string, taskId: string, body: string) =>
  apiRequest<TaskComment>(`${base(organizationId, projectId)}/${encodeURIComponent(taskId)}/comments`, { method: 'POST', body: { body } });

export const deleteTaskComment = (organizationId: string, projectId: string, taskId: string, commentId: string) =>
  apiRequest<null>(`${base(organizationId, projectId)}/${encodeURIComponent(taskId)}/comments/${encodeURIComponent(commentId)}`, { method: 'DELETE' });

// UX gating: a project ADMIN/MEMBER (or effective admin via org role) may contribute.
export const canContributeProject = (role: ProjectRole | null) => role === 'ADMIN' || role === 'MEMBER';
