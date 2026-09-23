'use client';

import Link from 'next/link';
import { Shell } from '../../components/shell';
import { useAuth } from '../../lib/auth-context';

function greeting(): string {
  const hour = new Date().getHours();
  if (hour < 12) return 'Good morning';
  if (hour < 18) return 'Good afternoon';
  return 'Good evening';
}

export default function Workspace() {
  const { user, roles } = useAuth();
  const today = new Date().toLocaleDateString(undefined, { weekday: 'long', month: 'long', day: 'numeric' });
  const firstName = user?.displayName?.split(' ')[0] ?? user?.username ?? 'there';

  return (
    <Shell>
      <header className="topbar">
        <div>
          <div className="eyebrow">{today}</div>
          <h1>
            {greeting()}, {firstName}
          </h1>
        </div>
        {roles.length > 0 && <span className="muted" style={{ fontSize: 13 }}>Role: {roles.join(', ')}</span>}
      </header>

      <section className="grid content" style={{ marginTop: 24 }}>
        <article className="card">
          <h2>Welcome to NexusForge</h2>
          <p className="muted" style={{ fontSize: 14, lineHeight: 1.6, marginTop: 8 }}>
            Your account is set up and secured. Projects, tasks, and analytics arrive in upcoming
            milestones. For now you can manage your identity, preferences, and active sessions.
          </p>
          <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap', marginTop: 8 }}>
            <Link className="button" href="/organizations">
              Organizations
            </Link>
            <Link className="secondary" href="/profile">
              Edit profile
            </Link>
            <Link className="secondary" href="/settings">
              Preferences
            </Link>
            <Link className="secondary" href="/settings/security">
              Security & sessions
            </Link>
          </div>
        </article>
        <aside className="grid">
          <article className="card">
            <h2>Signed in as</h2>
            <div className="task" style={{ borderBottom: 0 }}>
              <div>
                <div className="task-title">{user?.displayName}</div>
                <div className="task-meta">
                  @{user?.username} · {user?.email}
                </div>
              </div>
            </div>
          </article>
          <article className="card">
            <h2>Project analytics</h2>
            <p className="muted" style={{ fontSize: 14, lineHeight: 1.5 }}>
              Not available yet — workspace metrics will appear here once projects and tasks ship.
            </p>
          </article>
        </aside>
      </section>
    </Shell>
  );
}
