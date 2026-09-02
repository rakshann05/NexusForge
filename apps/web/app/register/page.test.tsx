import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import Register from './page';
import { AuthProvider } from '../../lib/auth-context';
import { setAccessToken } from '../../lib/api';

const replace = jest.fn();
jest.mock('next/navigation', () => ({
  useRouter: () => ({ replace, push: jest.fn() }),
  usePathname: () => '/register',
}));

function res(status: number, body?: unknown): Response {
  return {
    ok: status >= 200 && status < 300,
    status,
    text: () => Promise.resolve(body === undefined ? '' : JSON.stringify(body)),
  } as unknown as Response;
}

const user = { id: 'u1', email: 'a@b.co', username: 'ab', displayName: 'Ada B', avatarUrl: null, bio: null, timezone: 'UTC', language: 'en', theme: 'system' };

function routeFetch(routes: Array<[string, () => Response]>) {
  return jest.fn((input: string) => {
    const match = routes.find(([key]) => String(input).includes(key));
    return Promise.resolve(match ? match[1]() : res(404, {}));
  });
}

beforeEach(() => {
  replace.mockReset();
  setAccessToken(null);
});

function renderRegister() {
  return render(
    <AuthProvider>
      <Register />
    </AuthProvider>,
  );
}

describe('Register page', () => {
  it('blocks submission when passwords do not match and does not call the API', async () => {
    const fetchMock = routeFetch([['/auth/refresh', () => res(401, {})]]);
    (global as unknown as { fetch: jest.Mock }).fetch = fetchMock;
    renderRegister();
    await userEvent.type(await screen.findByLabelText('Name'), 'Ada B');
    await userEvent.type(screen.getByLabelText('Username'), 'ab_dev');
    await userEvent.type(screen.getByLabelText('Email'), 'ada@example.com');
    await userEvent.type(screen.getByLabelText('Password'), 'Password123!!');
    await userEvent.type(screen.getByLabelText('Confirm password'), 'Mismatch123!!');
    await userEvent.click(screen.getByRole('button', { name: /create account/i }));
    expect(await screen.findByText('Passwords do not match.')).toBeInTheDocument();
    expect(fetchMock.mock.calls.some(([url]) => String(url).includes('/auth/register'))).toBe(false);
  });

  it('registers and redirects on valid input', async () => {
    (global as unknown as { fetch: jest.Mock }).fetch = routeFetch([
      ['/auth/refresh', () => res(401, {})],
      ['/auth/register', () => res(200, { user, accessToken: 'tok', sessionId: 's1' })],
      ['/auth/roles', () => res(200, [])],
    ]);
    renderRegister();
    await userEvent.type(await screen.findByLabelText('Name'), 'Ada B');
    await userEvent.type(screen.getByLabelText('Username'), 'ab_dev');
    await userEvent.type(screen.getByLabelText('Email'), 'ada@example.com');
    await userEvent.type(screen.getByLabelText('Password'), 'Password123!!');
    await userEvent.type(screen.getByLabelText('Confirm password'), 'Password123!!');
    await userEvent.click(screen.getByRole('button', { name: /create account/i }));
    await waitFor(() => expect(replace).toHaveBeenCalledWith('/workspace'));
  });
});
