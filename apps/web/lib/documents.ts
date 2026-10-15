/**
 * Typed wrappers for the organization-scoped documents + revisions API.
 * Reading needs org membership; creating/editing/deleting/restoring require an
 * org contributor (not a VIEWER). The backend enforces this on every request.
 */
import { apiRequest } from './api';
import type { OrgRole } from './organizations';

export interface DocUser {
  id: string;
  displayName: string;
  username: string;
  avatarUrl: string | null;
}

export interface DocumentSummary {
  id: string;
  title: string;
  createdAt: string;
  updatedAt: string;
}

export interface DocumentDetail {
  id: string;
  title: string;
  content: string;
  organizationId: string;
  createdAt: string;
  updatedAt: string;
  updatedBy: DocUser | null;
}

export interface RevisionSummary {
  id: string;
  title: string;
  authorId: string | null;
  author: DocUser | null;
  createdAt: string;
}

export interface RevisionDetail {
  id: string;
  title: string;
  content: string;
  author: DocUser | null;
  createdAt: string;
}

const base = (organizationId: string) => `/organizations/${encodeURIComponent(organizationId)}/documents`;

export const listDocuments = (organizationId: string, q?: string) =>
  apiRequest<DocumentSummary[]>(`${base(organizationId)}${q ? `?q=${encodeURIComponent(q)}` : ''}`);

export const createDocument = (organizationId: string, input: { title: string; content?: string }) =>
  apiRequest<DocumentDetail>(base(organizationId), { method: 'POST', body: input });

export const getDocument = (organizationId: string, documentId: string) =>
  apiRequest<DocumentDetail>(`${base(organizationId)}/${encodeURIComponent(documentId)}`);

export const updateDocument = (
  organizationId: string,
  documentId: string,
  patch: { title?: string; content?: string; expectedUpdatedAt?: string },
) => apiRequest<DocumentDetail>(`${base(organizationId)}/${encodeURIComponent(documentId)}`, { method: 'PATCH', body: patch });

export const deleteDocument = (organizationId: string, documentId: string) =>
  apiRequest<null>(`${base(organizationId)}/${encodeURIComponent(documentId)}`, { method: 'DELETE' });

export const listRevisions = (organizationId: string, documentId: string) =>
  apiRequest<RevisionSummary[]>(`${base(organizationId)}/${encodeURIComponent(documentId)}/revisions`);

export const getRevision = (organizationId: string, documentId: string, revisionId: string) =>
  apiRequest<RevisionDetail>(`${base(organizationId)}/${encodeURIComponent(documentId)}/revisions/${encodeURIComponent(revisionId)}`);

export const restoreRevision = (organizationId: string, documentId: string, revisionId: string) =>
  apiRequest<DocumentDetail>(`${base(organizationId)}/${encodeURIComponent(documentId)}/revisions/${encodeURIComponent(revisionId)}/restore`, {
    method: 'POST',
  });

// UX gating: any org member except VIEWER may contribute to documents.
export const canContributeDocs = (orgRole: OrgRole) => orgRole !== 'VIEWER';
