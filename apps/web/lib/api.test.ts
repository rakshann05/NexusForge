import { apiRequest, ApiError, getAccessToken, refreshSession, setAccessToken, setOnUnauthorized } from './api';

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
  setAccessToken(null);
  setOnUnauthorized(null);
});

describe('apiRequest', () => {
  it('attaches the bearer token and credentials, and parses JSON', async () => {
    setAccessToken('tok');
    fetchMock.mockResolvedValueOnce(res(200, { id: 'u1' }));
    const out = await apiRequest<{ id: string }>('/auth/me');
    expect(out).toEqual({ id: 'u1' });
    const init = fetchMock.mock.calls[0][1];
    expect(init.headers.Authorization).toBe('Bearer tok');
    expect(init.credentials).toBe('include');
  });

  it('refreshes once and retries on 401, then succeeds', async () => {
    setAccessToken('old');
    fetchMock
      .mockResolvedValueOnce(res(401, { message: 'expired' })) // GET /auth/me
      .mockResolvedValueOnce(res(200, { user: {}, accessToken: 'new', sessionId: 's' })) // /auth/refresh
      .mockResolvedValueOnce(res(200, { id: 'u1' })); // retried /auth/me
    const out = await apiRequest<{ id: string }>('/auth/me');
    expect(out).toEqual({ id: 'u1' });
    expect(fetchMock).toHaveBeenCalledTimes(3);
    expect(getAccessToken()).toBe('new');
  });

  it('signals unauthorized and clears the token when refresh fails', async () => {
    setAccessToken('old');
    const onUnauthorized = jest.fn();
    setOnUnauthorized(onUnauthorized);
    fetchMock
      .mockResolvedValueOnce(res(401, { message: 'expired' }))
      .mockResolvedValueOnce(res(401, { message: 'no cookie' }));
    await expect(apiRequest('/auth/me')).rejects.toBeInstanceOf(ApiError);
    expect(onUnauthorized).toHaveBeenCalledTimes(1);
    expect(getAccessToken()).toBeNull();
  });

  it('does not refresh for unauthenticated calls and maps 429 to a friendly message', async () => {
    const onUnauthorized = jest.fn();
    setOnUnauthorized(onUnauthorized);
    fetchMock.mockResolvedValueOnce(res(429, {}));
    await expect(apiRequest('/auth/login', { method: 'POST', body: {}, auth: false })).rejects.toMatchObject({
      status: 429,
    });
    expect(fetchMock).toHaveBeenCalledTimes(1); // no refresh attempt
    expect(onUnauthorized).not.toHaveBeenCalled();
  });

  it('maps a network failure (server down) to a clear ApiError', async () => {
    fetchMock.mockRejectedValueOnce(new TypeError('Failed to fetch'));
    await expect(apiRequest('/auth/register', { method: 'POST', body: {}, auth: false })).rejects.toMatchObject({
      status: 0,
      message: expect.stringContaining('Cannot reach the server'),
    });
  });

  it('surfaces 409 duplicate messages from the backend', async () => {
    fetchMock.mockResolvedValueOnce(res(409, { message: 'Email is already registered' }));
    await expect(apiRequest('/auth/register', { method: 'POST', body: {}, auth: false })).rejects.toMatchObject({
      status: 409,
      message: 'Email is already registered',
    });
  });
});

describe('refreshSession', () => {
  it('coalesces concurrent refreshes into a single request (single-flight)', async () => {
    fetchMock.mockResolvedValue(res(200, { user: {}, accessToken: 'x', sessionId: 's' }));
    await Promise.all([refreshSession(), refreshSession(), refreshSession()]);
    expect(fetchMock).toHaveBeenCalledTimes(1);
  });
});
