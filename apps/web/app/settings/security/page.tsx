'use client';

import { useCallback, useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { AccountShell } from '../../../components/account-shell';
import { useAuth } from '../../../lib/auth-context';
import { listSessions, revokeSession } from '../../../lib/auth';
import { ApiError, SessionInfo } from '../../../lib/api';

function when(value: string): string {
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? '—' : date.toLocaleString();
}

export default function Security() {
  const { logoutAll } = useAuth();
  const router = useRouter();
  const [sessions, setSessions] = useState<SessionInfo[]>([]);
  const [state, setState] = useState<'loading' | 'ready' | 'error'>('loading');
  const [error, setError] = useState<string | null>(null);
  const [busyId, setBusyId] = useState<string | null>(null);

  const load = useCallback(async () => {
    setState('loading');
    setError(null);
    try {
      // The API returns revoked sessions too; only surface active ones.
      const all = await listSessions();
      setSessions(all.filter((session) => !session.revokedAt));
      setState('ready');
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'Could not load your sessions.');
      setState('error');
    }
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  async function onRevoke(session: SessionInfo) {
    setBusyId(session.id);
    setError(null);
    try {
      await revokeSession(session.id);
      if (session.current) {
        // Revoking the current session ends this login; drop to /login.
        router.replace('/login');
        return;
      }
      await load();
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'Could not revoke that session.');
    } finally {
      setBusyId(null);
    }
  }

  async function onSignOutEverywhere() {
    await logoutAll();
    router.replace('/login');
  }

  return (
    <AccountShell title="Security & sessions" description="Control account access across your devices.">
      <section className="card account-card">
        <h2>Password</h2>
        <p className="muted">Use a unique password with 12 or more characters.</p>
        <button className="secondary" type="button" disabled title="Password changes are not available yet">
          Change password (coming soon)
        </button>
      </section>

      <section className="card account-card">
        <div className="section-row">
          <div>
            <h2>Active sessions</h2>
            <p className="muted">Revoke any session you do not recognize.</p>
          </div>
          <button className="danger" type="button" onClick={onSignOutEverywhere}>
            Sign out everywhere
          </button>
        </div>

        {error && (
          <div className="alert alert-error" role="alert">
            {error}
          </div>
        )}
        {state === 'loading' && <p className="muted">Loading sessions…</p>}
        {state === 'ready' && sessions.length === 0 && <p className="muted">No active sessions.</p>}

        {sessions.map((session) => (
          <div className="session" key={session.id}>
            <span className="session-icon" aria-hidden="true">
              ⌘
            </span>
            <div>
              <b>{session.deviceName ?? 'Unknown device'}</b>
              <div className="task-meta">
                {(session.ipAddress ?? 'Unknown IP')} · Signed in {when(session.createdAt)} · Last active{' '}
                {when(session.lastActiveAt)}
              </div>
              {session.userAgent && (
                <div className="task-meta" style={{ opacity: 0.8 }}>
                  {session.userAgent}
                </div>
              )}
            </div>
            {session.current ? (
              <span className="session-current">Current</span>
            ) : (
              <button
                type="button"
                className="linkbtn"
                style={{ marginLeft: 'auto', color: '#b42318' }}
                onClick={() => onRevoke(session)}
                disabled={busyId === session.id}
              >
                {busyId === session.id ? 'Revoking…' : 'Revoke'}
              </button>
            )}
          </div>
        ))}
      </section>
    </AccountShell>
  );
}
