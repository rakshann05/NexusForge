'use client';

import { FormEvent, useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useAuth } from '../../lib/auth-context';
import { PublicOnly } from '../../components/auth-guard';
import { ApiError } from '../../lib/api';

// Mirrors the backend DTO rules closely enough to give fast feedback; the API
// remains the source of truth and its errors are surfaced too.
const USERNAME = /^[a-zA-Z0-9_]{3,32}$/;
const PASSWORD = /^(?=.*[a-z])(?=.*[A-Z])(?=.*\d)(?=.*[^A-Za-z0-9]).{12,128}$/;
const EMAIL = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

type Field = 'email' | 'username' | 'displayName' | 'password' | 'confirmPassword';

function RegisterForm() {
  const { register } = useAuth();
  const router = useRouter();
  const [values, setValues] = useState<Record<Field, string>>({
    email: '',
    username: '',
    displayName: '',
    password: '',
    confirmPassword: '',
  });
  const [errors, setErrors] = useState<Partial<Record<Field, string>>>({});
  const [formError, setFormError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  const set = (field: Field) => (e: { target: { value: string } }) =>
    setValues((prev) => ({ ...prev, [field]: e.target.value }));

  function validate(): boolean {
    const next: Partial<Record<Field, string>> = {};
    if (!EMAIL.test(values.email.trim())) next.email = 'Enter a valid email address.';
    if (!USERNAME.test(values.username.trim())) next.username = '3–32 characters: letters, numbers, or underscore.';
    if (values.displayName.trim().length < 2) next.displayName = 'Enter your name (at least 2 characters).';
    if (!PASSWORD.test(values.password))
      next.password = 'Password must be 12+ characters with upper, lower, number, and symbol.';
    if (values.confirmPassword !== values.password) next.confirmPassword = 'Passwords do not match.';
    setErrors(next);
    return Object.keys(next).length === 0;
  }

  async function onSubmit(event: FormEvent) {
    event.preventDefault();
    setFormError(null);
    if (!validate()) return;
    setSubmitting(true);
    try {
      await register({
        email: values.email.trim(),
        username: values.username.trim(),
        displayName: values.displayName.trim(),
        password: values.password,
        confirmPassword: values.confirmPassword,
      });
      router.replace('/workspace');
    } catch (err) {
      setFormError(err instanceof ApiError ? err.message : 'Unable to create your account. Please try again.');
      setSubmitting(false);
    }
  }

  const field = (id: Field, label: string, type: string, placeholder: string, autoComplete: string) => (
    <label htmlFor={id}>
      {label}
      <input
        id={id}
        className="input"
        type={type}
        placeholder={placeholder}
        autoComplete={autoComplete}
        value={values[id]}
        onChange={set(id)}
        disabled={submitting}
        aria-invalid={errors[id] ? true : undefined}
        aria-describedby={errors[id] ? `${id}-error` : undefined}
        required
      />
      {errors[id] && (
        <span className="field-error" id={`${id}-error`} role="alert">
          {errors[id]}
        </span>
      )}
    </label>
  );

  return (
    <main className="login">
      <section className="card login-card">
        <div className="brand" style={{ color: '#17212b', marginBottom: 28 }}>
          <span className="mark">N</span>NexusForge
        </div>
        <h1>Create your account</h1>
        <p className="muted">Start collaborating with your engineering team.</p>
        {formError && (
          <div className="alert alert-error" role="alert">
            {formError}
          </div>
        )}
        <form onSubmit={onSubmit} noValidate>
          {field('displayName', 'Name', 'text', 'Alex Morgan', 'name')}
          {field('username', 'Username', 'text', 'alexmorgan', 'username')}
          {field('email', 'Email', 'email', 'you@company.com', 'email')}
          {field('password', 'Password', 'password', '12+ characters, including a symbol', 'new-password')}
          {field('confirmPassword', 'Confirm password', 'password', 'Repeat your password', 'new-password')}
          <button className="button" style={{ width: '100%' }} type="submit" disabled={submitting} aria-busy={submitting}>
            {submitting ? <span className="spinner" aria-hidden="true" /> : null}
            {submitting ? 'Creating account…' : 'Create account'}
          </button>
        </form>
        <p className="muted" style={{ fontSize: 13 }}>
          Already have an account?{' '}
          <Link href="/login" style={{ color: '#315dca' }}>
            Sign in
          </Link>
        </p>
      </section>
    </main>
  );
}

export default function Register() {
  return (
    <PublicOnly>
      <RegisterForm />
    </PublicOnly>
  );
}
