import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import Login from './page';
import { AuthProvider } from '../../lib/auth-context';
import { setAccessToken } from '../../lib/api';

const replace = jest.fn();
jest.mock('next/navigation', () => ({
  useRouter: () => ({ replace, push: jest.fn() }),
  usePathname: () => '/login',
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

function renderLogin() {
  return render(
    <AuthProvider>
      <Login />
    </AuthProvider>,
  );
}

describe('Login page', () => {
  it('logs in and redirects to the workspace on success', async () => {
    (global as unknown as { fetch: jest.Mock }).fetch = routeFetch([
      ['/auth/refresh', () => res(401, {})],
      ['/auth/login', () => res(200, { user, accessToken: 'tok', sessionId: 's1' })],
      ['/auth/roles', () => res(200, [])],
    ]);
    renderLogin();
    const form = await screen.findByLabelText('Email or username');
    await userEvent.type(form, 'ab');
    await userEvent.type(screen.getByLabelText('Password'), 'Password123!!');
    await userEvent.click(screen.getByRole('button', { name: /sign in/i }));
    await waitFor(() => expect(replace).toHaveBeenCalledWith('/workspace'));
  });

  it('shows an error message on invalid credentials', async () => {
    (global as unknown as { fetch: jest.Mock }).fetch = routeFetch([
      ['/auth/refresh', () => res(401, {})],
      ['/auth/login', () => res(401, { message: 'Invalid credentials' })],
    ]);
    renderLogin();
    await userEvent.type(await screen.findByLabelText('Email or username'), 'ab');
    await userEvent.type(screen.getByLabelText('Password'), 'wrongpass');
    await userEvent.click(screen.getByRole('button', { name: /sign in/i }));
    expect(await screen.findByRole('alert')).toHaveTextContent('Invalid credentials');
    expect(replace).not.toHaveBeenCalled();
  });

  it('validates required fields before calling the API', async () => {
    const fetchMock = routeFetch([['/auth/refresh', () => res(401, {})]]);
    (global as unknown as { fetch: jest.Mock }).fetch = fetchMock;
    renderLogin();
    await screen.findByLabelText('Email or username');
    await userEvent.click(screen.getByRole('button', { name: /sign in/i }));
    expect(await screen.findByRole('alert')).toBeInTheDocument();
    expect(fetchMock.mock.calls.some(([url]) => String(url).includes('/auth/login'))).toBe(false);
  });
});
