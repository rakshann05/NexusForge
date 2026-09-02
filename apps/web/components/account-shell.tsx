'use client';

import Link from 'next/link';
import { useRouter, usePathname } from 'next/navigation';
import { useAuth } from '../lib/auth-context';
import { Protected } from './auth-guard';

export function AccountShell({
  title,
  description,
  children,
}: {
  title: string;
  description: string;
  children: React.ReactNode;
}) {
  const { logout } = useAuth();
  const router = useRouter();
  const pathname = usePathname();

  async function onLogout() {
    await logout();
    router.replace('/login');
  }

  const links: Array<[string, string]> = [
    ['/profile', 'Profile'],
    ['/settings', 'Preferences'],
    ['/settings/security', 'Security & sessions'],
  ];

  return (
    <Protected>
      <main className="account">
        <aside className="account-nav">
          <Link href="/workspace" className="brand">
            <span className="mark">N</span>NexusForge
          </Link>
          <div className="nav">
            {links.map(([href, label]) => (
              <Link key={href} href={href} aria-current={pathname === href ? 'page' : undefined}>
                {label}
              </Link>
            ))}
            <button type="button" className="logout-link" style={{ padding: '10px 12px' }} onClick={onLogout}>
              Log out
            </button>
          </div>
        </aside>
        <section className="account-content">
          <Link className="back" href="/workspace">
            ← Back to workspace
          </Link>
          <div className="account-heading">
            <h1>{title}</h1>
            <p className="muted">{description}</p>
          </div>
          {children}
        </section>
      </main>
    </Protected>
  );
}
