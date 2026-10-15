'use client';

import { FormEvent, useCallback, useEffect, useState } from 'react';
import Link from 'next/link';
import { useParams, useRouter } from 'next/navigation';
import { Shell } from '../../../../components/shell';
import { ApiError } from '../../../../lib/api';
import { getOrganization, Organization } from '../../../../lib/organizations';
import { canContributeDocs, createDocument, DocumentSummary, listDocuments } from '../../../../lib/documents';

export default function DocumentsPage() {
  const params = useParams<{ organizationId: string }>();
  const organizationId = params.organizationId;
  const router = useRouter();

  const [org, setOrg] = useState<Organization | null>(null);
  const [docs, setDocs] = useState<DocumentSummary[] | null>(null);
  const [query, setQuery] = useState('');
  const [loadError, setLoadError] = useState<string | null>(null);
  const [title, setTitle] = useState('');
  const [creating, setCreating] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const search = useCallback(
    async (q: string) => {
      try {
        setDocs(await listDocuments(organizationId, q || undefined));
      } catch (e) {
        setLoadError(e instanceof ApiError ? e.message : 'Failed to load documents.');
        setDocs([]);
      }
    },
    [organizationId],
  );

  useEffect(() => {
    getOrganization(organizationId).then(setOrg).catch(() => undefined);
    search('');
  }, [organizationId, search]);

  async function onSearch(event: FormEvent) {
    event.preventDefault();
    await search(query.trim());
  }

  async function onCreate(event: FormEvent) {
    event.preventDefault();
    setError(null);
    if (title.trim().length < 1) return;
    setCreating(true);
    try {
      const doc = await createDocument(organizationId, { title: title.trim() });
      router.push(`/organizations/${organizationId}/documents/${doc.id}`);
    } catch (e) {
      setError(e instanceof ApiError ? e.message : 'Could not create document.');
      setCreating(false);
    }
  }

  const canContribute = org ? canContributeDocs(org.role) : false;

  return (
    <Shell>
      <header className="topbar">
        <div>
          <div className="eyebrow">
            <Link href={`/organizations/${organizationId}`} style={{ color: 'inherit' }}>
              {org?.name ?? 'Organization'}
            </Link>
          </div>
          <h1>Knowledge base</h1>
        </div>
      </header>

      <section className="grid content" style={{ marginTop: 24 }}>
        <article className="card">
          <form onSubmit={onSearch} style={{ display: 'flex', gap: 8, marginBottom: 6 }}>
            <input className="input" style={{ margin: 0 }} value={query} onChange={(e) => setQuery(e.target.value)} placeholder="Search documents…" aria-label="Search documents" />
            <button className="secondary" type="submit">
              Search
            </button>
          </form>
          {loadError && (
            <div className="alert alert-error" role="alert">
              {loadError}
            </div>
          )}
          {docs === null && <p className="muted">Loading…</p>}
          {docs?.length === 0 && <p className="muted" style={{ marginTop: 8 }}>No documents found.</p>}
          {docs?.map((d) => (
            <Link key={d.id} href={`/organizations/${organizationId}/documents/${d.id}`} className="member-row" style={{ textDecoration: 'none' }}>
              <span className="org-avatar sm" style={{ background: '#eef2f6', color: '#4a5b6d' }}>
                📄
              </span>
              <div className="member-main">
                <div className="member-name">{d.title}</div>
                <div className="member-meta">updated {new Date(d.updatedAt).toLocaleString()}</div>
              </div>
              <span className="muted" aria-hidden="true">
                →
              </span>
            </Link>
          ))}
        </article>

        <aside className="grid">
          {canContribute ? (
            <article className="card">
              <h2>New document</h2>
              {error && (
                <div className="alert alert-error" role="alert">
                  {error}
                </div>
              )}
              <form onSubmit={onCreate} noValidate>
                <label htmlFor="doc-title">
                  Title <span className="req">*</span>
                  <input id="doc-title" className="input" value={title} onChange={(e) => setTitle(e.target.value)} maxLength={200} disabled={creating} required />
                </label>
                <button className="button" type="submit" disabled={creating} aria-busy={creating}>
                  {creating ? 'Creating…' : 'Create document'}
                </button>
              </form>
            </article>
          ) : (
            <article className="card">
              <h2>Knowledge base</h2>
              <p className="muted" style={{ fontSize: 14 }}>
                Viewers can read documents. Editing requires a member role or higher.
              </p>
            </article>
          )}
        </aside>
      </section>
    </Shell>
  );
}
