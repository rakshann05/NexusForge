import {
  addMember,
  canManageMembers,
  changeMemberRole,
  createOrganization,
  listOrganizations,
  removeMember,
  updateOrganization,
} from './organizations';
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

describe('organization api wrappers', () => {
  it('lists organizations via GET /organizations', async () => {
    fetchMock.mockResolvedValueOnce(res(200, []));
    await listOrganizations();
    const [url, init] = fetchMock.mock.calls[0];
    expect(url).toContain('/organizations');
    expect(init.method ?? 'GET').toBe('GET');
  });

  it('creates an organization via POST with name + description', async () => {
    fetchMock.mockResolvedValueOnce(res(201, { id: 'o1' }));
    await createOrganization({ name: 'Acme', description: 'desc' });
    const [url, init] = fetchMock.mock.calls[0];
    expect(url).toContain('/organizations');
    expect(init.method).toBe('POST');
    expect(JSON.parse(init.body)).toEqual({ name: 'Acme', description: 'desc' });
  });

  it('updates an organization via PATCH /organizations/:id', async () => {
    fetchMock.mockResolvedValueOnce(res(200, { id: 'o1' }));
    await updateOrganization('o1', { name: 'New' });
    const [url, init] = fetchMock.mock.calls[0];
    expect(url).toContain('/organizations/o1');
    expect(init.method).toBe('PATCH');
    expect(JSON.parse(init.body)).toEqual({ name: 'New' });
  });

  it('adds a member via POST /organizations/:id/members', async () => {
    fetchMock.mockResolvedValueOnce(res(201, { id: 'm1' }));
    await addMember('o1', { identifier: 'bob', role: 'ADMIN' });
    const [url, init] = fetchMock.mock.calls[0];
    expect(url).toContain('/organizations/o1/members');
    expect(init.method).toBe('POST');
    expect(JSON.parse(init.body)).toEqual({ identifier: 'bob', role: 'ADMIN' });
  });

  it('changes a role via PATCH /organizations/:id/members/:userId/role', async () => {
    fetchMock.mockResolvedValueOnce(res(200, { id: 'm1' }));
    await changeMemberRole('o1', 'u2', 'VIEWER');
    const [url, init] = fetchMock.mock.calls[0];
    expect(url).toContain('/organizations/o1/members/u2/role');
    expect(init.method).toBe('PATCH');
    expect(JSON.parse(init.body)).toEqual({ role: 'VIEWER' });
  });

  it('removes a member via DELETE /organizations/:id/members/:userId', async () => {
    fetchMock.mockResolvedValueOnce(res(204));
    await removeMember('o1', 'u2');
    const [url, init] = fetchMock.mock.calls[0];
    expect(url).toContain('/organizations/o1/members/u2');
    expect(init.method).toBe('DELETE');
  });

  it('gates management controls to owner/admin (UX helper)', () => {
    expect(canManageMembers('OWNER')).toBe(true);
    expect(canManageMembers('ADMIN')).toBe(true);
    expect(canManageMembers('MEMBER')).toBe(false);
    expect(canManageMembers('VIEWER')).toBe(false);
  });
});
