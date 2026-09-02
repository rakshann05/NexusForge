'use client';

import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useAuth } from '../lib/auth-context';
import { Protected } from './auth-guard';

export function Shell({ children }: { children: React.ReactNode }) {
  const { user, logout } = useAuth();
  const router = useRouter();

  async function onLogout() {
    await logout();
    router.replace('/login');
  }

  return (
    <Protected>
    <div className="shell">
      <aside className="sidebar">
        <Link href="/workspace" className="brand">
          <span className="mark">N</span>NexusForge
        </Link>
        <div className="nav">
          <span className="active">Overview</span>
          <span>My work</span>
          <span>Projects</span>
          <span>Knowledge base</span>
          <span>Team chat</span>
          <span>Analytics</span>
        </div>
        <div className="sidebar-user">
          <div>
            <b>{user?.displayName ?? 'Your account'}</b>
            <br />
            <span className="muted">{user?.email ?? ''}</span>
          </div>
          <div style={{ display: 'flex', gap: 12 }}>
            <Link href="/profile" className="linkbtn" style={{ color: '#9fb2c4' }}>
              Account
            </Link>
            <button type="button" className="logout-link" onClick={onLogout}>
              Log out
            </button>
          </div>
        </div>
      </aside>
      <main className="workspace">{children}</main>
    </div>
    </Protected>
  );
}
