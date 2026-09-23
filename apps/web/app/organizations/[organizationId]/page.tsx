'use client';

import { FormEvent, useCallback, useEffect, useState } from 'react';
import { useParams, useRouter } from 'next/navigation';
import { Shell } from '../../../components/shell';
import { useAuth } from '../../../lib/auth-context';
import { ApiError } from '../../../lib/api';
import {
  addMember,
  canManageMembers,
  canUpdateOrg,
  changeMemberRole,
  getOrganization,
  listMembers,
  OrgMember,
  OrgRole,
  Organization,
  removeMember,
  updateOrganization,
} from '../../../lib/organizations';

const ASSIGNABLE: OrgRole[] = ['OWNER', 'ADMIN', 'MEMBER', 'VIEWER'];

function RoleBadge({ role }: { role: OrgRole }) {
  return <span className={`role-badge ${role.toLowerCase()}`}>{role.toLowerCase()}</span>;
}

export default function OrganizationDetail() {
  const params = useParams<{ organizationId: string }>();
  const organizationId = params.organizationId;
  const router = useRouter();
  const { user } = useAuth();

  const [org, setOrg] = useState<Organization | null>(null);
  const [members, setMembers] = useState<OrgMember[]>([]);
  const [state, setState] = useState<'loading' | 'ready' | 'error'>('loading');
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const [busyUserId, setBusyUserId] = useState<string | null>(null);

  // Edit-org form
  const [name, setName] = useState('');
  const [description, setDescription] = useState('');
  const [savingOrg, setSavingOrg] = useState(false);

  // Add-member form
  const [identifier, setIdentifier] = useState('');
  const [addRole, setAddRole] = useState<OrgRole>('MEMBER');
  const [addingMember, setAddingMember] = useState(false);
  const [addError, setAddError] = useState<string | null>(null);

  const load = useCallback(async () => {
    setState('loading');
    setError(null);
    try {
      const loaded = await getOrganization(organizationId);
      setOrg(loaded);
      setName(loaded.name);
      setDescription(loaded.description ?? '');
      setMembers(await listMembers(organizationId));
      setState('ready');
    } catch (e) {
      setError(e instanceof ApiError ? e.message : 'Failed to load organization.');
      setState('error');
    }
  }, [organizationId]);

  useEffect(() => {
    load();
  }, [load]);

  async function onSaveOrg(event: FormEvent) {
    event.preventDefault();
    if (!org) return;
    setError(null);
    setNotice(null);
    setSavingOrg(true);
    try {
      const updated = await updateOrganization(organizationId, { name: name.trim(), description: description.trim() });
      setOrg(updated);
      setNotice('Organization updated.');
    } catch (e) {
      setError(e instanceof ApiError ? e.message : 'Could not update organization.');
    } finally {
      setSavingOrg(false);
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
      await addMember(organizationId, { identifier: identifier.trim(), role: addRole });
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

  async function refreshMembers() {
    setMembers(await listMembers(organizationId));
    const refreshed = await getOrganization(organizationId).catch(() => null);
    if (refreshed) setOrg(refreshed);
  }

  async function onChangeRole(member: OrgMember, role: OrgRole) {
    setError(null);
    setNotice(null);
    setBusyUserId(member.user.id);
    try {
      await changeMemberRole(organizationId, member.user.id, role);
      await refreshMembers();
      setNotice('Role updated.');
    } catch (e) {
      setError(e instanceof ApiError ? e.message : 'Could not change role.');
    } finally {
      setBusyUserId(null);
    }
  }

  async function onRemove(member: OrgMember) {
    const isSelf = member.user.id === user?.id;
    setError(null);
    setNotice(null);
    setBusyUserId(member.user.id);
    try {
      await removeMember(organizationId, member.user.id);
      if (isSelf) {
        router.push('/organizations');
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

  if (state === 'error' || !org) {
    return (
      <Shell>
        <header className="topbar">
          <h1>Organization</h1>
        </header>
        <section className="card" style={{ marginTop: 24 }}>
          <div className="alert alert-error" role="alert">
            {error ?? 'Organization not found.'}
          </div>
          <a className="back" href="/organizations">
            ← Back to organizations
          </a>
        </section>
      </Shell>
    );
  }

  const manage = canManageMembers(org.role);

  return (
    <Shell>
      <header className="topbar">
        <div>
          <div className="eyebrow">Organization</div>
          <h1 style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
            {org.name} <RoleBadge role={org.role} />
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
        <article className="card">
          <div className="section-row">
            <div>
              <h2>Members</h2>
              <p className="muted">
                {org.memberCount} member{org.memberCount === 1 ? '' : 's'}
              </p>
            </div>
          </div>

          {members.map((m) => {
            const isSelf = m.user.id === user?.id;
            const busy = busyUserId === m.user.id;
            return (
              <div className="member-row" key={m.id}>
                <span className="org-avatar sm" style={{ background: '#dbe8ff', color: '#315dca' }}>
                  {m.user.displayName[0]?.toUpperCase()}
                </span>
                <div className="member-main">
                  <div className="member-name">
                    {m.user.displayName}
                    {isSelf ? ' (you)' : ''}
                  </div>
                  <div className="member-meta">
                    @{m.user.username} · {m.user.email} · joined {new Date(m.joinedAt).toLocaleDateString()}
                  </div>
                </div>
                <div className="member-actions">
                  {manage ? (
                    <select
                      className="input"
                      aria-label={`Role for ${m.user.displayName}`}
                      value={m.role}
                      disabled={busy}
                      onChange={(e) => onChangeRole(m, e.target.value as OrgRole)}
                    >
                      {ASSIGNABLE.map((r) => (
                        <option key={r} value={r}>
                          {r.charAt(0) + r.slice(1).toLowerCase()}
                        </option>
                      ))}
                    </select>
                  ) : (
                    <RoleBadge role={m.role} />
                  )}
                  {(manage || isSelf) && (
                    <button
                      type="button"
                      className="linkbtn"
                      style={{ color: '#b42318' }}
                      disabled={busy}
                      onClick={() => onRemove(m)}
                    >
                      {isSelf ? 'Leave' : 'Remove'}
                    </button>
                  )}
                </div>
              </div>
            );
          })}
        </article>

        <aside className="grid">
          {canUpdateOrg(org.role) && (
            <article className="card">
              <h2>Organization details</h2>
              <form onSubmit={onSaveOrg} noValidate>
                <label htmlFor="edit-name">
                  Name <span className="req">*</span>
                  <input
                    id="edit-name"
                    className="input"
                    value={name}
                    onChange={(e) => setName(e.target.value)}
                    maxLength={80}
                    disabled={savingOrg}
                    required
                  />
                </label>
                <label htmlFor="edit-description">
                  Description
                  <textarea
                    id="edit-description"
                    className="input"
                    value={description}
                    onChange={(e) => setDescription(e.target.value)}
                    maxLength={500}
                    disabled={savingOrg}
                  />
                </label>
                <button className="button" type="submit" disabled={savingOrg} aria-busy={savingOrg}>
                  {savingOrg ? <span className="spinner" aria-hidden="true" /> : null}
                  {savingOrg ? 'Saving…' : 'Save changes'}
                </button>
              </form>
            </article>
          )}

          {manage && (
            <article className="card">
              <h2>Add member</h2>
              <p className="muted" style={{ fontSize: 13 }}>
                Add an existing NexusForge user by email or username.
              </p>
              {addError && (
                <div className="alert alert-error" role="alert">
                  {addError}
                </div>
              )}
              <form onSubmit={onAddMember} noValidate>
                <label htmlFor="add-identifier">
                  Email or username
                  <input
                    id="add-identifier"
                    className="input"
                    value={identifier}
                    onChange={(e) => setIdentifier(e.target.value)}
                    disabled={addingMember}
                    required
                  />
                </label>
                <label htmlFor="add-role">
                  Role
                  <select
                    id="add-role"
                    className="input"
                    value={addRole}
                    onChange={(e) => setAddRole(e.target.value as OrgRole)}
                    disabled={addingMember}
                  >
                    {ASSIGNABLE.filter((r) => r !== 'OWNER' || org.role === 'OWNER').map((r) => (
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

          {!manage && (
            <article className="card">
              <h2>Your access</h2>
              <p className="muted" style={{ fontSize: 14 }}>
                You are a <span style={{ textTransform: 'capitalize' }}>{org.role.toLowerCase()}</span> of this
                organization. Member management is available to owners and admins.
              </p>
            </article>
          )}
        </aside>
      </section>
    </Shell>
  );
}
