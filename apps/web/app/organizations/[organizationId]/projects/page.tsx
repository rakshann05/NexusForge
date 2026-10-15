'use client';

import { FormEvent, useCallback, useEffect, useState } from 'react';
import Link from 'next/link';
import { useParams, useRouter } from 'next/navigation';
import { Shell } from '../../../../components/shell';
import { ApiError } from '../../../../lib/api';
import { getOrganization, Organization } from '../../../../lib/organizations';
import { canCreateProject, createProject, listProjects, Project } from '../../../../lib/projects';

export default function ProjectsPage() {
  const params = useParams<{ organizationId: string }>();
  const organizationId = params.organizationId;
  const router = useRouter();

  const [org, setOrg] = useState<Organization | null>(null);
  const [projects, setProjects] = useState<Project[] | null>(null);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [name, setName] = useState('');
  const [description, setDescription] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  const load = useCallback(async () => {
    setLoadError(null);
    try {
      const [o, list] = await Promise.all([getOrganization(organizationId), listProjects(organizationId)]);
      setOrg(o);
      setProjects(list);
    } catch (e) {
      setLoadError(e instanceof ApiError ? e.message : 'Failed to load projects.');
      setProjects([]);
    }
  }, [organizationId]);

  useEffect(() => {
    load();
  }, [load]);

  async function onCreate(event: FormEvent) {
    event.preventDefault();
    setError(null);
    if (name.trim().length < 2) {
      setError('Project name must be at least 2 characters.');
      return;
    }
    setSubmitting(true);
    try {
      const project = await createProject(organizationId, { name: name.trim(), description: description.trim() || undefined });
      router.push(`/organizations/${organizationId}/projects/${project.id}`);
    } catch (e) {
      setError(e instanceof ApiError ? e.message : 'Could not create project.');
      setSubmitting(false);
    }
  }

  const canCreate = org ? canCreateProject(org.role) : false;

  return (
    <Shell>
      <header className="topbar">
        <div>
          <div className="eyebrow">
            <Link href={`/organizations/${organizationId}`} style={{ color: 'inherit' }}>
              {org?.name ?? 'Organization'}
            </Link>
          </div>
          <h1>Projects</h1>
        </div>
      </header>

      <section className="grid content" style={{ marginTop: 24 }}>
        <article className="card">
          <h2>Projects</h2>
          {loadError && (
            <div className="alert alert-error" role="alert">
              {loadError}
            </div>
          )}
          {projects === null && <p className="muted">Loading…</p>}
          {projects?.length === 0 && (
            <p className="muted" style={{ marginTop: 8 }}>
              No projects yet.{canCreate ? ' Create one to get started.' : ''}
            </p>
          )}
          {projects?.map((p) => (
            <Link key={p.id} href={`/organizations/${organizationId}/projects/${p.id}`} className="member-row" style={{ textDecoration: 'none' }}>
              <span className="org-avatar" style={{ background: '#e6f0ff', color: '#315dca' }}>
                {p.name[0]?.toUpperCase()}
              </span>
              <div className="member-main">
                <div className="member-name">{p.name}</div>
                <div className="member-meta">
                  {p.description ? `${p.description} · ` : ''}
                  {p.memberCount} member{p.memberCount === 1 ? '' : 's'} · updated{' '}
                  {new Date(p.updatedAt).toLocaleDateString()}
                </div>
              </div>
              <span className="muted" aria-hidden="true">
                →
              </span>
            </Link>
          ))}
        </article>

        <aside className="grid">
          {canCreate ? (
            <article className="card">
              <h2>Create project</h2>
              {error && (
                <div className="alert alert-error" role="alert">
                  {error}
                </div>
              )}
              <form onSubmit={onCreate} noValidate>
                <label htmlFor="project-name">
                  Name <span className="req">*</span>
                  <input
                    id="project-name"
                    className="input"
                    value={name}
                    onChange={(e) => setName(e.target.value)}
                    maxLength={120}
                    disabled={submitting}
                    required
                  />
                </label>
                <label htmlFor="project-description">
                  Description
                  <textarea
                    id="project-description"
                    className="input"
                    value={description}
                    onChange={(e) => setDescription(e.target.value)}
                    maxLength={2000}
                    disabled={submitting}
                  />
                </label>
                <button className="button" type="submit" disabled={submitting} aria-busy={submitting}>
                  {submitting ? <span className="spinner" aria-hidden="true" /> : null}
                  {submitting ? 'Creating…' : 'Create project'}
                </button>
              </form>
            </article>
          ) : (
            <article className="card">
              <h2>Projects</h2>
              <p className="muted" style={{ fontSize: 14 }}>
                Only organization owners and admins can create projects.
              </p>
            </article>
          )}
        </aside>
      </section>
    </Shell>
  );
}
