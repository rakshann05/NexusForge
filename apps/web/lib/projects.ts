/**
 * Typed wrappers for the project endpoints (nested under an organization).
 * `role` on a Project is the caller's role from the server: on the detail
 * endpoint it is the EFFECTIVE role (ADMIN when the caller may manage, i.e. an
 * org OWNER/ADMIN or a project ADMIN), which drives UX only. The backend
 * re-checks authorization on every request.
 */
import { apiRequest } from './api';
import type { OrgRole } from './organizations';

export type ProjectRole = 'ADMIN' | 'MEMBER' | 'VIEWER';

export interface Project {
  id: string;
  name: string;
  description: string | null;
  organizationId: string;
  organization: { id: string; name: string };
  archivedAt: string | null;
  createdAt: string;
  updatedAt: string;
  memberCount: number;
  role: ProjectRole | null;
}

export interface ProjectMemberUser {
  id: string;
  username: string;
  displayName: string;
  email: string;
  avatarUrl: string | null;
}

export interface ProjectMember {
  id: string;
  role: ProjectRole;
  joinedAt: string;
  user: ProjectMemberUser;
}

const base = (organizationId: string) => `/organizations/${encodeURIComponent(organizationId)}/projects`;

export const listProjects = (organizationId: string) => apiRequest<Project[]>(base(organizationId));

export const createProject = (organizationId: string, input: { name: string; description?: string }) =>
  apiRequest<Project>(base(organizationId), { method: 'POST', body: input });

export const getProject = (organizationId: string, projectId: string) =>
  apiRequest<Project>(`${base(organizationId)}/${encodeURIComponent(projectId)}`);

export const updateProject = (organizationId: string, projectId: string, patch: { name?: string; description?: string }) =>
  apiRequest<Project>(`${base(organizationId)}/${encodeURIComponent(projectId)}`, { method: 'PATCH', body: patch });

export const archiveProject = (organizationId: string, projectId: string) =>
  apiRequest<null>(`${base(organizationId)}/${encodeURIComponent(projectId)}`, { method: 'DELETE' });

export const listProjectMembers = (organizationId: string, projectId: string) =>
  apiRequest<ProjectMember[]>(`${base(organizationId)}/${encodeURIComponent(projectId)}/members`);

export const addProjectMember = (organizationId: string, projectId: string, input: { identifier: string; role?: ProjectRole }) =>
  apiRequest<ProjectMember>(`${base(organizationId)}/${encodeURIComponent(projectId)}/members`, { method: 'POST', body: input });

export const changeProjectMemberRole = (organizationId: string, projectId: string, userId: string, role: ProjectRole) =>
  apiRequest<ProjectMember>(`${base(organizationId)}/${encodeURIComponent(projectId)}/members/${encodeURIComponent(userId)}/role`, {
    method: 'PATCH',
    body: { role },
  });

export const removeProjectMember = (organizationId: string, projectId: string, userId: string) =>
  apiRequest<null>(`${base(organizationId)}/${encodeURIComponent(projectId)}/members/${encodeURIComponent(userId)}`, {
    method: 'DELETE',
  });

// Client-side gating (UX only — the server enforces the real rules).
export const canCreateProject = (orgRole: OrgRole) => orgRole === 'OWNER' || orgRole === 'ADMIN';
export const canManageProject = (projectRole: ProjectRole | null) => projectRole === 'ADMIN';
