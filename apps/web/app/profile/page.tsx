'use client';

import { FormEvent, useEffect, useState } from 'react';
import { AccountShell } from '../../components/account-shell';
import { useAuth } from '../../lib/auth-context';
import { ApiError } from '../../lib/api';

function initials(name: string): string {
  return (
    name
      .split(' ')
      .map((part) => part[0])
      .filter(Boolean)
      .slice(0, 2)
      .join('')
      .toUpperCase() || 'U'
  );
}

export default function Profile() {
  const { user, updateProfile } = useAuth();
  const [displayName, setDisplayName] = useState('');
  const [bio, setBio] = useState('');
  const [avatarUrl, setAvatarUrl] = useState('');
  const [status, setStatus] = useState<'idle' | 'saving' | 'saved'>('idle');
  const [error, setError] = useState<string | null>(null);

  // Seed the form from the authenticated user (present once AccountShell's guard passes).
  useEffect(() => {
    if (user) {
      setDisplayName(user.displayName ?? '');
      setBio(user.bio ?? '');
      setAvatarUrl(user.avatarUrl ?? '');
    }
  }, [user]);

  async function onSubmit(event: FormEvent) {
    event.preventDefault();
    setError(null);
    if (displayName.trim().length < 2) {
      setError('Display name must be at least 2 characters.');
      return;
    }
    setStatus('saving');
    try {
      await updateProfile({ displayName: displayName.trim(), bio: bio.trim(), avatarUrl: avatarUrl.trim() });
      setStatus('saved');
    } catch (err) {
      setStatus('idle');
      setError(err instanceof ApiError ? err.message : 'Could not save your profile. Please try again.');
    }
  }

  const saving = status === 'saving';

  return (
    <AccountShell title="Public profile" description="Manage how teammates see you across NexusForge.">
      <section className="card account-card">
        {error && (
          <div className="alert alert-error" role="alert">
            {error}
          </div>
        )}
        {status === 'saved' && (
          <div className="alert alert-success" role="status">
            Profile saved.
          </div>
        )}
        {avatarUrl ? (
          <img className="avatar" src={avatarUrl} alt="" style={{ objectFit: 'cover' }} />
        ) : (
          <div className="avatar" aria-hidden="true">
            {initials(displayName || user?.username || 'U')}
          </div>
        )}
        <form onSubmit={onSubmit} noValidate>
          <label htmlFor="displayName">
            Display name <span className="req">*</span>
            <input
              id="displayName"
              className="input"
              value={displayName}
              onChange={(e) => setDisplayName(e.target.value)}
              disabled={saving}
              maxLength={80}
              required
            />
          </label>
          <label htmlFor="username">
            Username
            <input id="username" className="input" value={user?.username ?? ''} disabled readOnly />
            <span className="task-meta">Usernames can’t be changed yet.</span>
          </label>
          <label htmlFor="avatarUrl">
            Avatar URL
            <input
              id="avatarUrl"
              className="input"
              type="url"
              placeholder="https://…"
              value={avatarUrl}
              onChange={(e) => setAvatarUrl(e.target.value)}
              disabled={saving}
              maxLength={2048}
            />
          </label>
          <label htmlFor="bio">
            Bio
            <textarea
              id="bio"
              className="input"
              value={bio}
              onChange={(e) => setBio(e.target.value)}
              disabled={saving}
              maxLength={500}
            />
          </label>
          <button className="button" type="submit" disabled={saving} aria-busy={saving}>
            {saving ? <span className="spinner" aria-hidden="true" /> : null}
            {saving ? 'Saving…' : 'Save profile'}
          </button>
        </form>
      </section>
    </AccountShell>
  );
}
