import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { AuthProvider, useAuth } from './auth-context';
import { setAccessToken } from './api';

function res(status: number, body?: unknown): Response {
  return {
    ok: status >= 200 && status < 300,
    status,
    text: () => Promise.resolve(body === undefined ? '' : JSON.stringify(body)),
  } as unknown as Response;
}

const user = { id: 'u1', email: 'a@b.co', username: 'ab', displayName: 'Ada B', avatarUrl: null, bio: null, timezone: 'UTC', language: 'en', theme: 'system' };

/** Route a mocked fetch by URL substring. */
function routeFetch(routes: Array<[string, () => Response]>) {
  return jest.fn((input: string) => {
    const match = routes.find(([key]) => String(input).includes(key));
    return Promise.resolve(match ? match[1]() : res(404, {}));
  });
}

function Harness() {
  const { status, user: u, login, logout } = useAuth();
  return (
    <div>
      <span data-testid="status">{status}</span>
      <span data-testid="user">{u?.displayName ?? ''}</span>
      <button onClick={() => login('ab', 'pw').catch(() => {})}>login</button>
      <button onClick={() => logout()}>logout</button>
    </div>
  );
}

beforeEach(() => setAccessToken(null));

describe('AuthProvider', () => {
  it('lands on unauthenticated when the silent refresh fails', async () => {
    (global as unknown as { fetch: jest.Mock }).fetch = routeFetch([['/auth/refresh', () => res(401, { message: 'no cookie' })]]);
    render(
      <AuthProvider>
        <Harness />
      </AuthProvider>,
    );
    await waitFor(() => expect(screen.getByTestId('status')).toHaveTextContent('unauthenticated'));
    expect(screen.getByTestId('user')).toHaveTextContent('');
  });

  it('becomes authenticated with the real user after login', async () => {
    (global as unknown as { fetch: jest.Mock }).fetch = routeFetch([
      ['/auth/refresh', () => res(401, {})],
      ['/auth/login', () => res(200, { user, accessToken: 'tok', sessionId: 's1' })],
      ['/auth/roles', () => res(200, [{ role: { key: 'MEMBER' } }])],
    ]);
    render(
      <AuthProvider>
        <Harness />
      </AuthProvider>,
    );
    await waitFor(() => expect(screen.getByTestId('status')).toHaveTextContent('unauthenticated'));
    await userEvent.click(screen.getByText('login'));
    await waitFor(() => expect(screen.getByTestId('status')).toHaveTextContent('authenticated'));
    expect(screen.getByTestId('user')).toHaveTextContent('Ada B');
  });

  it('clears state on logout', async () => {
    (global as unknown as { fetch: jest.Mock }).fetch = routeFetch([
      ['/auth/refresh', () => res(200, { user, accessToken: 'tok', sessionId: 's1' })],
      ['/auth/roles', () => res(200, [])],
      ['/auth/logout', () => res(204)],
    ]);
    render(
      <AuthProvider>
        <Harness />
      </AuthProvider>,
    );
    await waitFor(() => expect(screen.getByTestId('status')).toHaveTextContent('authenticated'));
    await userEvent.click(screen.getByText('logout'));
    await waitFor(() => expect(screen.getByTestId('status')).toHaveTextContent('unauthenticated'));
  });
});
