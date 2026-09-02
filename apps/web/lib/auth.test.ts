import { getRoleKeys, revokeSession, updateProfile } from './auth';
import { setAccessToken, setOnUnauthorized } from './api';

function res(status: number, body?: unknown): Response {
  return {
    ok: status >= 200 && status < 300,
    status,
    text: () => Promise.resolve(body === undefined ? '' : JSON.stringify(body)),
  } as unknown as Response;
}

const fetchMock = jest.fn();

beforeEach(() => {
  (global as unknown as { fetch: jest.Mock }).fetch = fetchMock;
  fetchMock.mockReset();
  setAccessToken('tok');
  setOnUnauthorized(null);
});

describe('auth endpoint wrappers', () => {
  it('updateProfile sends PATCH /auth/me with the patch body', async () => {
    fetchMock.mockResolvedValueOnce(res(200, { id: 'u1', displayName: 'New Name' }));
    const user = await updateProfile({ displayName: 'New Name' });
    expect(user.displayName).toBe('New Name');
    const [url, init] = fetchMock.mock.calls[0];
    expect(url).toContain('/auth/me');
    expect(init.method).toBe('PATCH');
    expect(JSON.parse(init.body)).toEqual({ displayName: 'New Name' });
  });

  it('revokeSession issues DELETE to the session path (id encoded)', async () => {
    fetchMock.mockResolvedValueOnce(res(204));
    await revokeSession('sess 1');
    const [url, init] = fetchMock.mock.calls[0];
    expect(url).toContain('/auth/sessions/sess%201');
    expect(init.method).toBe('DELETE');
  });

  it('getRoleKeys maps the roles payload to role keys', async () => {
    fetchMock.mockResolvedValueOnce(res(200, [{ role: { key: 'MEMBER' } }, { role: { key: 'ADMIN' } }]));
    await expect(getRoleKeys()).resolves.toEqual(['MEMBER', 'ADMIN']);
  });
});
