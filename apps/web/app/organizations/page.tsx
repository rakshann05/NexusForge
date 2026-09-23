'use client';

import { FormEvent, useEffect, useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { Shell } from '../../components/shell';
import { ApiError } from '../../lib/api';
import { createOrganization, listOrganizations, Organization } from '../../lib/organizations';

export default function OrganizationsPage() {
  const router = useRouter();
  const [orgs, setOrgs] = useState<Organization[] | null>(null);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [name, setName] = useState('');
  const [description, setDescription] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    let active = true;
    listOrganizations()
      .then((list) => active && setOrgs(list))
      .catch((e) => {
        if (!active) return;
        setLoadError(e instanceof ApiError ? e.message : 'Failed to load organizations.');
        setOrgs([]);
      });
    return () => {
      active = false;
    };
  }, []);

  async function onCreate(event: FormEvent) {
    event.preventDefault();
    setError(null);
    if (name.trim().length < 2) {
      setError('Organization name must be at least 2 characters.');
      return;
    }
    setSubmitting(true);
    try {
      const org = await createOrganization({ name: name.trim(), description: description.trim() || undefined });
      router.push(`/organizations/${org.id}`);
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'Could not create organization.');
      setSubmitting(false);
    }
  }

  return (
    <Shell>
      <header className="topbar">
        <div>
          <div className="eyebrow">Workspace</div>
          <h1>Organizations</h1>
        </div>
      </header>

      <section className="grid content" style={{ marginTop: 24 }}>
        <article className="card">
          <h2>Your organizations</h2>
          {loadError && (
            <div className="alert alert-error" role="alert">
              {loadError}
            </div>
          )}
          {orgs === null && <p className="muted">Loading…</p>}
          {orgs?.length === 0 && (
            <p className="muted" style={{ marginTop: 8 }}>
              You don’t belong to any organization yet. Create one to get started.
            </p>
          )}
          {orgs?.map((o) => (
            <Link key={o.id} href={`/organizations/${o.id}`} className="member-row" style={{ textDecoration: 'none' }}>
              <span className="org-avatar" style={{ background: '#dbe8ff', color: '#315dca' }}>
                {o.name[0]?.toUpperCase()}
              </span>
              <div className="member-main">
                <div className="member-name">{o.name}</div>
                <div className="member-meta">
                  {o.memberCount} member{o.memberCount === 1 ? '' : 's'} · your role:{' '}
                  <span style={{ textTransform: 'capitalize' }}>{o.role.toLowerCase()}</span>
                </div>
              </div>
              <span className="muted" aria-hidden="true">
                →
              </span>
            </Link>
          ))}
        </article>

        <aside className="grid">
          <article className="card">
            <h2>Create organization</h2>
            {error && (
              <div className="alert alert-error" role="alert">
                {error}
              </div>
            )}
            <form onSubmit={onCreate} noValidate>
              <label htmlFor="org-name">
                Name <span className="req">*</span>
                <input
                  id="org-name"
                  className="input"
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  maxLength={80}
                  disabled={submitting}
                  required
                />
              </label>
              <label htmlFor="org-description">
                Description
                <textarea
                  id="org-description"
                  className="input"
                  value={description}
                  onChange={(e) => setDescription(e.target.value)}
                  maxLength={500}
                  disabled={submitting}
                />
              </label>
              <button className="button" type="submit" disabled={submitting} aria-busy={submitting}>
                {submitting ? <span className="spinner" aria-hidden="true" /> : null}
                {submitting ? 'Creating…' : 'Create organization'}
              </button>
            </form>
          </article>
        </aside>
      </section>
    </Shell>
  );
}
