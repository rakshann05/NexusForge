'use client';

import { FormEvent, useEffect, useState } from 'react';
import { AccountShell } from '../../components/account-shell';
import { useAuth } from '../../lib/auth-context';
import { ApiError } from '../../lib/api';

const TIMEZONES = ['UTC', 'Asia/Kolkata', 'America/New_York', 'America/Los_Angeles', 'Europe/London', 'Europe/Berlin'];
const LANGUAGES: Array<[string, string]> = [
  ['en', 'English'],
  ['es', 'Español'],
  ['fr', 'Français'],
  ['de', 'Deutsch'],
];
const THEMES: Array<[string, string]> = [
  ['system', 'System'],
  ['light', 'Light'],
  ['dark', 'Dark'],
];

export default function Settings() {
  const { user, updateProfile } = useAuth();
  const [timezone, setTimezone] = useState('UTC');
  const [language, setLanguage] = useState('en');
  const [theme, setTheme] = useState('system');
  const [status, setStatus] = useState<'idle' | 'saving' | 'saved'>('idle');
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (user) {
      setTimezone(user.timezone ?? 'UTC');
      setLanguage(user.language ?? 'en');
      setTheme(user.theme ?? 'system');
    }
  }, [user]);

  async function onSubmit(event: FormEvent) {
    event.preventDefault();
    setError(null);
    setStatus('saving');
    try {
      await updateProfile({ timezone, language, theme });
      setStatus('saved');
    } catch (err) {
      setStatus('idle');
      setError(err instanceof ApiError ? err.message : 'Could not save your preferences. Please try again.');
    }
  }

  const saving = status === 'saving';

  return (
    <AccountShell title="Preferences" description="Personalize your NexusForge experience.">
      <section className="card account-card">
        {error && (
          <div className="alert alert-error" role="alert">
            {error}
          </div>
        )}
        {status === 'saved' && (
          <div className="alert alert-success" role="status">
            Preferences saved.
          </div>
        )}
        <form onSubmit={onSubmit}>
          <label htmlFor="email">
            Email
            <input id="email" className="input" type="email" value={user?.email ?? ''} disabled readOnly />
            <span className="task-meta">Changing your email isn’t available yet.</span>
          </label>
          <label htmlFor="timezone">
            Timezone
            <select
              id="timezone"
              className="input"
              value={timezone}
              onChange={(e) => setTimezone(e.target.value)}
              disabled={saving}
            >
              {TIMEZONES.map((tz) => (
                <option key={tz} value={tz}>
                  {tz}
                </option>
              ))}
            </select>
          </label>
          <label htmlFor="language">
            Language
            <select
              id="language"
              className="input"
              value={language}
              onChange={(e) => setLanguage(e.target.value)}
              disabled={saving}
            >
              {LANGUAGES.map(([code, label]) => (
                <option key={code} value={code}>
                  {label}
                </option>
              ))}
            </select>
          </label>
          <label htmlFor="theme">
            Theme
            <select id="theme" className="input" value={theme} onChange={(e) => setTheme(e.target.value)} disabled={saving}>
              {THEMES.map(([value, label]) => (
                <option key={value} value={value}>
                  {label}
                </option>
              ))}
            </select>
          </label>
          <button className="button" type="submit" disabled={saving} aria-busy={saving}>
            {saving ? <span className="spinner" aria-hidden="true" /> : null}
            {saving ? 'Saving…' : 'Save preferences'}
          </button>
        </form>
      </section>
    </AccountShell>
  );
}
