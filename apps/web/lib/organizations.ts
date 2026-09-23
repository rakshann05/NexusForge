/**
 * Typed wrappers for the organization endpoints. All calls go through the shared
 * API client (credentials + bearer + refresh handled there). The `role` on an
 * Organization is the caller's role from the server — it drives UX only; the
 * backend re-checks authorization on every request.
 */
import { apiRequest } from './api';

export type OrgRole = 'OWNER' | 'ADMIN' | 'MEMBER' | 'VIEWER';

export interface Organization {
  id: string;
  name: string;
  slug: string;
  description: string | null;
  createdAt: string;
  updatedAt: string;
  memberCount: number;
  role: OrgRole;
}

export interface OrgMemberUser {
  id: string;
  username: string;
  displayName: string;
  email: string;
  avatarUrl: string | null;
}

export interface OrgMember {
  id: string;
  role: OrgRole;
  joinedAt: string;
  user: OrgMemberUser;
}

export const listOrganizations = () => apiRequest<Organization[]>('/organizations');

export const createOrganization = (input: { name: string; description?: string }) =>
  apiRequest<Organization>('/organizations', { method: 'POST', body: input });

export const getOrganization = (organizationId: string) =>
  apiRequest<Organization>(`/organizations/${encodeURIComponent(organizationId)}`);

export const updateOrganization = (organizationId: string, patch: { name?: string; description?: string }) =>
  apiRequest<Organization>(`/organizations/${encodeURIComponent(organizationId)}`, { method: 'PATCH', body: patch });

export const listMembers = (organizationId: string) =>
  apiRequest<OrgMember[]>(`/organizations/${encodeURIComponent(organizationId)}/members`);

export const addMember = (organizationId: string, input: { identifier: string; role?: OrgRole }) =>
  apiRequest<OrgMember>(`/organizations/${encodeURIComponent(organizationId)}/members`, { method: 'POST', body: input });

export const changeMemberRole = (organizationId: string, userId: string, role: OrgRole) =>
  apiRequest<OrgMember>(`/organizations/${encodeURIComponent(organizationId)}/members/${encodeURIComponent(userId)}/role`, {
    method: 'PATCH',
    body: { role },
  });

export const removeMember = (organizationId: string, userId: string) =>
  apiRequest<null>(`/organizations/${encodeURIComponent(organizationId)}/members/${encodeURIComponent(userId)}`, {
    method: 'DELETE',
  });

// Client-side helpers for showing/hiding controls. NOT security — the server
// enforces the same rules.
export const canManageMembers = (role: OrgRole) => role === 'OWNER' || role === 'ADMIN';
export const canUpdateOrg = (role: OrgRole) => role === 'OWNER' || role === 'ADMIN';
