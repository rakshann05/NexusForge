'use client';

import { useCallback, useEffect, useState } from 'react';
import Link from 'next/link';
import { useParams, useRouter } from 'next/navigation';
import { Shell } from '../../../../../components/shell';
import { Markdown } from '../../../../../components/markdown';
import { ApiError } from '../../../../../lib/api';
import { getOrganization } from '../../../../../lib/organizations';
import {
  canContributeDocs,
  deleteDocument,
  DocumentDetail,
  getDocument,
  getRevision,
  listRevisions,
  restoreRevision,
  RevisionSummary,
  updateDocument,
} from '../../../../../lib/documents';

export default function DocumentEditor() {
  const params = useParams<{ organizationId: string; documentId: string }>();
  const { organizationId, documentId } = params;
  const router = useRouter();

  const [doc, setDoc] = useState<DocumentDetail | null>(null);
  const [revisions, setRevisions] = useState<RevisionSummary[]>([]);
  const [canContribute, setCanContribute] = useState(false);
  const [state, setState] = useState<'loading' | 'ready' | 'error'>('loading');
  const [error, setError] = useState<string | null>(null);
  const [saveState, setSaveState] = useState<'idle' | 'saving' | 'saved'>('idle');

  const [title, setTitle] = useState('');
  const [content, setContent] = useState('');
  const [preview, setPreview] = useState<string | null>(null); // a revision being previewed

  const load = useCallback(async () => {
    setState('loading');
    setError(null);
    try {
      const [d, org, revs] = await Promise.all([
        getDocument(organizationId, documentId),
        getOrganization(organizationId),
        listRevisions(organizationId, documentId),
      ]);
      setDoc(d);
      setTitle(d.title);
      setContent(d.content);
      setCanContribute(canContributeDocs(org.role));
      setRevisions(revs);
      setPreview(null);
      setState('ready');
    } catch (e) {
      setError(e instanceof ApiError ? e.message : 'Failed to load document.');
      setState('error');
    }
  }, [organizationId, documentId]);

  useEffect(() => {
    load();
  }, [load]);

  async function onSave() {
    if (!doc) return;
    setError(null);
    setSaveState('saving');
    try {
      const updated = await updateDocument(organizationId, documentId, {
        title: title.trim(),
        content,
        expectedUpdatedAt: doc.updatedAt,
      });
      setDoc(updated);
      setSaveState('saved');
      setRevisions(await listRevisions(organizationId, documentId));
    } catch (e) {
      setSaveState('idle');
      setError(e instanceof ApiError ? e.message : 'Could not save document.');
    }
  }

  async function onDelete() {
    setError(null);
    try {
      await deleteDocument(organizationId, documentId);
      router.push(`/organizations/${organizationId}/documents`);
    } catch (e) {
      setError(e instanceof ApiError ? e.message : 'Could not delete document.');
    }
  }

  async function onPreviewRevision(revisionId: string) {
    try {
      const rev = await getRevision(organizationId, documentId, revisionId);
      setPreview(rev.content);
    } catch (e) {
      setError(e instanceof ApiError ? e.message : 'Could not load revision.');
    }
  }

  async function onRestore(revisionId: string) {
    setError(null);
    try {
      const updated = await restoreRevision(organizationId, documentId, revisionId);
      setDoc(updated);
      setTitle(updated.title);
      setContent(updated.content);
      setPreview(null);
      setRevisions(await listRevisions(organizationId, documentId));
    } catch (e) {
      setError(e instanceof ApiError ? e.message : 'Could not restore revision.');
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

  if (state === 'error' || !doc) {
    return (
      <Shell>
        <header className="topbar">
          <h1>Document</h1>
        </header>
        <section className="card" style={{ marginTop: 24 }}>
          <div className="alert alert-error" role="alert">
            {error ?? 'Document not found.'}
          </div>
          <Link className="back" href={`/organizations/${organizationId}/documents`}>
            ← Back to knowledge base
          </Link>
        </section>
      </Shell>
    );
  }

  return (
    <Shell>
      <header className="topbar">
        <div>
          <div className="eyebrow">
            <Link href={`/organizations/${organizationId}/documents`} style={{ color: 'inherit' }}>
              Knowledge base
            </Link>
          </div>
          <h1>{doc.title}</h1>
        </div>
        {canContribute && (
          <div style={{ display: 'flex', gap: 10, alignItems: 'center' }}>
            {saveState === 'saved' && <span className="muted" style={{ fontSize: 13 }}>Saved</span>}
            <button className="button" type="button" onClick={onSave} disabled={saveState === 'saving'} aria-busy={saveState === 'saving'}>
              {saveState === 'saving' ? 'Saving…' : 'Save'}
            </button>
          </div>
        )}
      </header>

      {error && (
        <div className="alert alert-error" role="alert" style={{ marginTop: 8 }}>
          {error}
        </div>
      )}
      <p className="muted" style={{ fontSize: 13, marginTop: 4 }}>
        Last updated {new Date(doc.updatedAt).toLocaleString()}
        {doc.updatedBy ? ` by ${doc.updatedBy.displayName}` : ''}
      </p>

      {canContribute && (
        <label style={{ display: 'block', marginTop: 10 }}>
          Title
          <input className="input" value={title} onChange={(e) => setTitle(e.target.value)} maxLength={200} />
        </label>
      )}

      <section style={{ marginTop: 10 }}>
        {canContribute ? (
          <div className="doc-editor">
            <label>
              <span className="sr-only">Markdown content</span>
              <textarea className="input" value={content} onChange={(e) => setContent(e.target.value)} maxLength={100000} aria-label="Markdown content" />
            </label>
            <div className="doc-preview" aria-label="Preview">
              <Markdown content={preview ?? content} />
            </div>
          </div>
        ) : (
          <div className="doc-preview">
            <Markdown content={preview ?? doc.content} />
          </div>
        )}
      </section>

      <section className="grid content" style={{ marginTop: 16 }}>
        <article className="card">
          <h2>Revisions</h2>
          {preview !== null && (
            <div className="alert alert-info" role="status">
              Previewing an earlier revision.{' '}
              <button className="linkbtn" type="button" onClick={() => setPreview(null)}>
                Back to current
              </button>
            </div>
          )}
          {revisions.length === 0 && <p className="muted">No revisions yet.</p>}
          {revisions.map((r) => (
            <div className="revision" key={r.id}>
              <div>
                <b>{new Date(r.createdAt).toLocaleString()}</b>
                <div className="muted">{r.author ? r.author.displayName : 'Unknown'} · {r.title}</div>
              </div>
              <div style={{ display: 'flex', gap: 10 }}>
                <button className="linkbtn" type="button" onClick={() => onPreviewRevision(r.id)}>
                  view
                </button>
                {canContribute && (
                  <button className="linkbtn" type="button" onClick={() => onRestore(r.id)}>
                    restore
                  </button>
                )}
              </div>
            </div>
          ))}
        </article>

        <aside className="grid">
          {canContribute && (
            <article className="card">
              <h2>Danger zone</h2>
              <p className="muted" style={{ fontSize: 13 }}>
                Deleting a document is permanent and removes its revisions.
              </p>
              <button type="button" className="danger" onClick={onDelete}>
                Delete document
              </button>
            </article>
          )}
        </aside>
      </section>
    </Shell>
  );
}
