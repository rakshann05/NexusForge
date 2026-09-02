'use client';

import { FormEvent, useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useAuth } from '../../lib/auth-context';
import { PublicOnly } from '../../components/auth-guard';
import { ApiError } from '../../lib/api';

function LoginForm() {
  const { login } = useAuth();
  const router = useRouter();
  const [identifier, setIdentifier] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  async function onSubmit(event: FormEvent) {
    event.preventDefault();
    setError(null);
    if (!identifier.trim() || !password) {
      setError('Enter your email or username and your password.');
      return;
    }
    setSubmitting(true);
    try {
      await login(identifier.trim(), password);
      router.replace('/workspace');
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'Unable to sign in. Please try again.');
      setSubmitting(false);
    }
  }

  return (
    <main className="login">
      <section className="card login-card">
        <div className="brand" style={{ color: '#17212b', marginBottom: 28 }}>
          <span className="mark">N</span>NexusForge
        </div>
        <h1>Welcome back</h1>
        <p className="muted">Sign in to your engineering workspace.</p>
        {error && (
          <div className="alert alert-error" role="alert">
            {error}
          </div>
        )}
        <form onSubmit={onSubmit} noValidate>
          <label htmlFor="identifier">
            Email or username
            <input
              id="identifier"
              className="input"
              autoComplete="username"
              placeholder="you@company.com or alexmorgan"
              value={identifier}
              onChange={(e) => setIdentifier(e.target.value)}
              disabled={submitting}
              required
            />
          </label>
          <label htmlFor="password">
            Password
            <input
              id="password"
              className="input"
              type="password"
              autoComplete="current-password"
              placeholder="••••••••••"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              disabled={submitting}
              required
            />
          </label>
          <div className="form-link">
            <Link href="/forgot-password">Forgot password?</Link>
          </div>
          <button className="button" style={{ width: '100%' }} type="submit" disabled={submitting} aria-busy={submitting}>
            {submitting ? <span className="spinner" aria-hidden="true" /> : null}
            {submitting ? 'Signing in…' : 'Sign in'}
          </button>
        </form>
        <p className="muted" style={{ fontSize: 13 }}>
          New to NexusForge?{' '}
          <Link href="/register" style={{ color: '#315dca' }}>
            Create an account
          </Link>
        </p>
      </section>
    </main>
  );
}

export default function Login() {
  return (
    <PublicOnly>
      <LoginForm />
    </PublicOnly>
  );
}
