'use client';

/**
 * Client-side route protection for this milestone.
 *
 * NOTE: protection is CLIENT-SIDE only. The refresh cookie is owned by the API
 * origin, so Next.js middleware/SSR on the web origin cannot read or validate
 * the backend JWT. The real security boundary remains the API, which rejects
 * unauthorized requests. A first-party BFF cookie would enable server-side
 * protection later (see ARCHITECTURE.md).
 */
import { useEffect } from 'react';
import { useRouter } from 'next/navigation';
import type { ReactNode } from 'react';
import { useAuth } from '../lib/auth-context';

function FullPageStatus({ message }: { message: string }) {
  return (
    <main className="login" role="status" aria-live="polite">
      <section className="card login-card" style={{ textAlign: 'center' }}>
        <div className="brand" style={{ color: '#17212b', justifyContent: 'center', marginBottom: 16 }}>
          <span className="mark">N</span>NexusForge
        </div>
        <p className="muted">{message}</p>
      </section>
    </main>
  );
}

/** Renders children only for authenticated users; redirects others to /login. */
export function Protected({ children }: { children: ReactNode }) {
  const { status } = useAuth();
  const router = useRouter();

  useEffect(() => {
    if (status === 'unauthenticated') router.replace('/login');
  }, [status, router]);

  if (status === 'authenticated') return <>{children}</>;
  return <FullPageStatus message={status === 'loading' ? 'Checking your session…' : 'Redirecting to sign in…'} />;
}

/** For /login and /register: sends already-authenticated users to /workspace. */
export function PublicOnly({ children }: { children: ReactNode }) {
  const { status } = useAuth();
  const router = useRouter();

  useEffect(() => {
    if (status === 'authenticated') router.replace('/workspace');
  }, [status, router]);

  if (status === 'authenticated') return <FullPageStatus message="Redirecting to your workspace…" />;
  return <>{children}</>;
}
