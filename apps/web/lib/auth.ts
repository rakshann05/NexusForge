/**
 * Typed wrappers around the existing NestJS auth endpoints. Every auth API call
 * in the app goes through here so fetch logic is never duplicated in pages.
 * Paths are relative to NEXT_PUBLIC_API_URL (which already ends in `/api`).
 */
import { apiRequest, AuthResponse, AuthUser, SessionInfo } from './api';

export interface RegisterInput {
  email: string;
  username: string;
  displayName: string;
  password: string;
  confirmPassword: string;
}

export type ProfileUpdate = Partial<{
  displayName: string;
  bio: string;
  timezone: string;
  language: string;
  theme: string;
  avatarUrl: string;
}>;

interface RoleRow {
  role: { key: string };
}

export const login = (identifier: string, password: string) =>
  apiRequest<AuthResponse>('/auth/login', { method: 'POST', body: { identifier, password }, auth: false });

export const register = (input: RegisterInput) =>
  apiRequest<AuthResponse>('/auth/register', { method: 'POST', body: input, auth: false });

export const logout = () => apiRequest<null>('/auth/logout', { method: 'POST' });

export const logoutAll = () => apiRequest<null>('/auth/logout-all', { method: 'POST' });

export const getMe = () => apiRequest<AuthUser>('/auth/me');

export const updateProfile = (patch: ProfileUpdate) =>
  apiRequest<AuthUser>('/auth/me', { method: 'PATCH', body: patch });

export const listSessions = () => apiRequest<SessionInfo[]>('/auth/sessions');

export const revokeSession = (sessionId: string) =>
  apiRequest<null>(`/auth/sessions/${encodeURIComponent(sessionId)}`, { method: 'DELETE' });

export const getRoleKeys = async (): Promise<string[]> => {
  const rows = await apiRequest<RoleRow[]>('/auth/roles');
  return rows.map((row) => row.role.key);
};
