'use client';

import { FormEvent, useCallback, useEffect, useState } from 'react';
import Link from 'next/link';
import { useParams, useRouter } from 'next/navigation';
import { Shell } from '../../../../../components/shell';
import { useAuth } from '../../../../../lib/auth-context';
import { ApiError } from '../../../../../lib/api';
import {
  addProjectMember,
  archiveProject,
  canManageProject,
  changeProjectMemberRole,
  getProject,
  listProjectMembers,
  Project,
  ProjectMember,
  ProjectRole,
  removeProjectMember,
  updateProject,
} from '../../../../../lib/projects';

const ROLES: ProjectRole[] = ['ADMIN', 'MEMBER', 'VIEWER'];

function RoleBadge({ role }: { role: ProjectRole }) {
  return <span className={`role-badge ${role.toLowerCase()}`}>{role.toLowerCase()}</span>;
}

export default function ProjectDetail() {
  const params = useParams<{ organizationId: string; projectId: string }>();
  const { organizationId, projectId } = params;
  const router = useRouter();
  const { user } = useAuth();

  const [project, setProject] = useState<Project | null>(null);
  const [members, setMembers] = useState<ProjectMember[]>([]);
  const [state, setState] = useState<'loading' | 'ready' | 'error'>('loading');
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const [busyUserId, setBusyUserId] = useState<string | null>(null);

  const [name, setName] = useState('');
  const [description, setDescription] = useState('');
  const [savingProject, setSavingProject] = useState(false);

  const [identifier, setIdentifier] = useState('');
  const [addRole, setAddRole] = useState<ProjectRole>('MEMBER');
  const [addingMember, setAddingMember] = useState(false);
  const [addError, setAddError] = useState<string | null>(null);

  const load = useCallback(async () => {
    setState('loading');
    setError(null);
    try {
      const loaded = await getProject(organizationId, projectId);
      setProject(loaded);
      setName(loaded.name);
      setDescription(loaded.description ?? '');
      setMembers(await listProjectMembers(organizationId, projectId));
      setState('ready');
    } catch (e) {
      setError(e instanceof ApiError ? e.message : 'Failed to load project.');
      setState('error');
    }
  }, [organizationId, projectId]);

  useEffect(() => {
    load();
  }, [load]);

  async function refreshMembers() {
    setMembers(await listProjectMembers(organizationId, projectId));
    const refreshed = await getProject(organizationId, projectId).catch(() => null);
    if (refreshed) setProject(refreshed);
  }

  async function onSaveProject(event: FormEvent) {
    event.preventDefault();
    setError(null);
    setNotice(null);
    setSavingProject(true);
    try {
      const updated = await updateProject(organizationId, projectId, { name: name.trim(), description: description.trim() });
      setProject(updated);
      setNotice('Project updated.');
    } catch (e) {
      setError(e instanceof ApiError ? e.message : 'Could not update project.');
    } finally {
      setSavingProject(false);
    }
  }

  async function onArchive() {
    setError(null);
    try {
      await archiveProject(organizationId, projectId);
      router.push(`/organizations/${organizationId}/projects`);
    } catch (e) {
      setError(e instanceof ApiError ? e.message : 'Could not archive project.');
    }
  }

  async function onAddMember(event: FormEvent) {
    event.preventDefault();
    setAddError(null);
    if (identifier.trim().length < 3) {
      setAddError('Enter an email or username.');
      return;
    }
    setAddingMember(true);
    try {
      await addProjectMember(organizationId, projectId, { identifier: identifier.trim(), role: addRole });
      setIdentifier('');
      setAddRole('MEMBER');
      await refreshMembers();
      setNotice('Member added.');
    } catch (e) {
      setAddError(e instanceof ApiError ? e.message : 'Could not add member.');
    } finally {
      setAddingMember(false);
    }
  }

  async function onChangeRole(member: ProjectMember, role: ProjectRole) {
    setError(null);
    setNotice(null);
    setBusyUserId(member.user.id);
    try {
      await changeProjectMemberRole(organizationId, projectId, member.user.id, role);
      await refreshMembers();
      setNotice('Role updated.');
    } catch (e) {
      setError(e instanceof ApiError ? e.message : 'Could not change role.');
    } finally {
      setBusyUserId(null);
    }
  }

  async function onRemove(member: ProjectMember) {
    const isSelf = member.user.id === user?.id;
    setError(null);
    setNotice(null);
    setBusyUserId(member.user.id);
    try {
      await removeProjectMember(organizationId, projectId, member.user.id);
      if (isSelf) {
        router.push(`/organizations/${organizationId}/projects`);
        return;
      }
      await refreshMembers();
      setNotice('Member removed.');
    } catch (e) {
      setError(e instanceof ApiError ? e.message : 'Could not remove member.');
      setBusyUserId(null);
    }
  }

  if (state === 'loading') {
    return (
      <Shell>
        <header className="topbar">
          <h1>Loading…</h1>
        </header>
      </Shell>
    );
  }

  if (state === 'error' || !project) {
    return (
      <Shell>
        <header className="topbar">
          <h1>Project</h1>
        </header>
        <section className="card" style={{ marginTop: 24 }}>
          <div className="alert alert-error" role="alert">
            {error ?? 'Project not found.'}
          </div>
          <Link className="back" href={`/organizations/${organizationId}/projects`}>
            ← Back to projects
          </Link>
        </section>
      </Shell>
    );
  }

  const manage = canManageProject(project.role);

  return (
    <Shell>
      <header className="topbar">
        <div>
          <div className="eyebrow">
            <Link href={`/organizations/${organizationId}/projects`} style={{ color: 'inherit' }}>
              {project.organization.name} · Projects
            </Link>
          </div>
          <h1 style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
            {project.name}
            {project.archivedAt && <span className="role-badge">archived</span>}
          </h1>
        </div>
      </header>

      {notice && (
        <div className="alert alert-success" role="status" style={{ marginTop: 8 }}>
          {notice}
        </div>
      )}
      {error && (
        <div className="alert alert-error" role="alert" style={{ marginTop: 8 }}>
          {error}
        </div>
      )}

      <section className="grid content" style={{ marginTop: 16 }}>
        <div className="grid">
          <article className="card">
            <h2>Overview</h2>
            <p className="muted" style={{ fontSize: 14, lineHeight: 1.6, marginTop: 8 }}>
              {project.description || 'No description yet.'}
            </p>
            <div className="task-meta" style={{ marginTop: 10 }}>
              {project.memberCount} member{project.memberCount === 1 ? '' : 's'} · created{' '}
              {new Date(project.createdAt).toLocaleDateString()}
              {project.role ? ` · your role: ${project.role.toLowerCase()}` : ''}
            </div>
          </article>

          <article className="card">
            <div className="section-row">
              <div>
                <h2>Members</h2>
                <p className="muted">
                  {project.memberCount} member{project.memberCount === 1 ? '' : 's'}
                </p>
              </div>
            </div>
            {members.map((m) => {
              const isSelf = m.user.id === user?.id;
              const busy = busyUserId === m.user.id;
              return (
                <div className="member-row" key={m.id}>
                  <span className="org-avatar sm" style={{ background: '#e6f0ff', color: '#315dca' }}>
                    {m.user.displayName[0]?.toUpperCase()}
                  </span>
                  <div className="member-main">
                    <div className="member-name">
                      {m.user.displayName}
                      {isSelf ? ' (you)' : ''}
                    </div>
                    <div className="member-meta">
                      @{m.user.username} · joined {new Date(m.joinedAt).toLocaleDateString()}
                    </div>
                  </div>
                  <div className="member-actions">
                    {manage ? (
                      <select
                        className="input"
                        aria-label={`Role for ${m.user.displayName}`}
                        value={m.role}
                        disabled={busy}
                        onChange={(e) => onChangeRole(m, e.target.value as ProjectRole)}
                      >
                        {ROLES.map((r) => (
                          <option key={r} value={r}>
                            {r.charAt(0) + r.slice(1).toLowerCase()}
                          </option>
                        ))}
                      </select>
                    ) : (
                      <RoleBadge role={m.role} />
                    )}
                    {(manage || isSelf) && (
                      <button type="button" className="linkbtn" style={{ color: '#b42318' }} disabled={busy} onClick={() => onRemove(m)}>
                        {isSelf ? 'Leave' : 'Remove'}
                      </button>
                    )}
                  </div>
                </div>
              );
            })}
          </article>

          <article className="card">
            <h2>Tasks</h2>
            <p className="muted" style={{ fontSize: 14 }}>
              Coming in the next milestone.
            </p>
          </article>
        </div>

        <aside className="grid">
          {manage && (
            <article className="card">
              <h2>Project details</h2>
              <form onSubmit={onSaveProject} noValidate>
                <label htmlFor="edit-project-name">
                  Name <span className="req">*</span>
                  <input
                    id="edit-project-name"
                    className="input"
                    value={name}
                    onChange={(e) => setName(e.target.value)}
                    maxLength={120}
                    disabled={savingProject}
                    required
                  />
                </label>
                <label htmlFor="edit-project-description">
                  Description
                  <textarea
                    id="edit-project-description"
                    className="input"
                    value={description}
                    onChange={(e) => setDescription(e.target.value)}
                    maxLength={2000}
                    disabled={savingProject}
                  />
                </label>
                <button className="button" type="submit" disabled={savingProject} aria-busy={savingProject}>
                  {savingProject ? <span className="spinner" aria-hidden="true" /> : null}
                  {savingProject ? 'Saving…' : 'Save changes'}
                </button>
              </form>
            </article>
          )}

          {manage && (
            <article className="card">
              <h2>Add member</h2>
              <p className="muted" style={{ fontSize: 13 }}>
                Project members must belong to this organization.
              </p>
              {addError && (
                <div className="alert alert-error" role="alert">
                  {addError}
                </div>
              )}
              <form onSubmit={onAddMember} noValidate>
                <label htmlFor="add-project-member">
                  Email or username
                  <input
                    id="add-project-member"
                    className="input"
                    value={identifier}
                    onChange={(e) => setIdentifier(e.target.value)}
                    disabled={addingMember}
                    required
                  />
                </label>
                <label htmlFor="add-project-role">
                  Role
                  <select id="add-project-role" className="input" value={addRole} onChange={(e) => setAddRole(e.target.value as ProjectRole)} disabled={addingMember}>
                    {ROLES.map((r) => (
                      <option key={r} value={r}>
                        {r.charAt(0) + r.slice(1).toLowerCase()}
                      </option>
                    ))}
                  </select>
                </label>
                <button className="button" type="submit" disabled={addingMember} aria-busy={addingMember}>
                  {addingMember ? <span className="spinner" aria-hidden="true" /> : null}
                  {addingMember ? 'Adding…' : 'Add member'}
                </button>
              </form>
            </article>
          )}

          {manage && !project.archivedAt && (
            <article className="card">
              <h2>Danger zone</h2>
              <p className="muted" style={{ fontSize: 13 }}>
                Archiving hides the project. Its data is preserved.
              </p>
              <button type="button" className="danger" onClick={onArchive}>
                Archive project
              </button>
            </article>
          )}

          {!manage && (
            <article className="card">
              <h2>Your access</h2>
              <p className="muted" style={{ fontSize: 14 }}>
                {project.role
                  ? `You are a ${project.role.toLowerCase()} on this project.`
                  : 'You can view this project as an organization member.'}{' '}
                Project management is available to project admins and organization owners/admins.
              </p>
            </article>
          )}
        </aside>
      </section>
    </Shell>
  );
}
