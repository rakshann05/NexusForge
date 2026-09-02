import { render, screen, waitFor } from '@testing-library/react';
import { AuthProvider } from '../lib/auth-context';
import { Protected } from './auth-guard';
import { setAccessToken } from '../lib/api';

const replace = jest.fn();
jest.mock('next/navigation', () => ({
  useRouter: () => ({ replace, push: jest.fn() }),
  usePathname: () => '/',
}));

function res(status: number, body?: unknown): Response {
  return {
    ok: status >= 200 && status < 300,
    status,
    text: () => Promise.resolve(body === undefined ? '' : JSON.stringify(body)),
  } as unknown as Response;
}

const user = { id: 'u1', email: 'a@b.co', username: 'ab', displayName: 'Ada B', avatarUrl: null, bio: null, timezone: 'UTC', language: 'en', theme: 'system' };

beforeEach(() => {
  replace.mockReset();
  setAccessToken(null);
});

describe('Protected', () => {
  it('redirects unauthenticated users to /login and hides content', async () => {
    (global as unknown as { fetch: jest.Mock }).fetch = jest.fn(() => Promise.resolve(res(401, {})));
    render(
      <AuthProvider>
        <Protected>
          <div>secret content</div>
        </Protected>
      </AuthProvider>,
    );
    await waitFor(() => expect(replace).toHaveBeenCalledWith('/login'));
    expect(screen.queryByText('secret content')).not.toBeInTheDocument();
  });

  it('renders content for authenticated users', async () => {
    (global as unknown as { fetch: jest.Mock }).fetch = jest.fn((input: string) =>
      Promise.resolve(
        String(input).includes('/auth/roles')
          ? res(200, [])
          : res(200, { user, accessToken: 'tok', sessionId: 's1' }),
      ),
    );
    render(
      <AuthProvider>
        <Protected>
          <div>secret content</div>
        </Protected>
      </AuthProvider>,
    );
    await waitFor(() => expect(screen.getByText('secret content')).toBeInTheDocument());
    expect(replace).not.toHaveBeenCalled();
  });
});
