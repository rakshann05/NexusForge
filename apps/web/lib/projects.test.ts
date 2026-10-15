import {
  addProjectMember,
  archiveProject,
  canCreateProject,
  canManageProject,
  changeProjectMemberRole,
  createProject,
  getProject,
  listProjects,
  removeProjectMember,
  updateProject,
} from './projects';
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

describe('project api wrappers', () => {
  it('lists projects for an organization', async () => {
    fetchMock.mockResolvedValueOnce(res(200, []));
    await listProjects('o1');
    expect(fetchMock.mock.calls[0][0]).toContain('/organizations/o1/projects');
  });

  it('creates a project via POST with name + description', async () => {
    fetchMock.mockResolvedValueOnce(res(201, { id: 'p1' }));
    await createProject('o1', { name: 'Proj', description: 'd' });
    const [url, init] = fetchMock.mock.calls[0];
    expect(url).toContain('/organizations/o1/projects');
    expect(init.method).toBe('POST');
    expect(JSON.parse(init.body)).toEqual({ name: 'Proj', description: 'd' });
  });

  it('gets a project scoped to the org+project ids', async () => {
    fetchMock.mockResolvedValueOnce(res(200, { id: 'p1' }));
    await getProject('o1', 'p1');
    expect(fetchMock.mock.calls[0][0]).toContain('/organizations/o1/projects/p1');
  });

  it('updates a project via PATCH', async () => {
    fetchMock.mockResolvedValueOnce(res(200, { id: 'p1' }));
    await updateProject('o1', 'p1', { name: 'New' });
    const [url, init] = fetchMock.mock.calls[0];
    expect(url).toContain('/organizations/o1/projects/p1');
    expect(init.method).toBe('PATCH');
    expect(JSON.parse(init.body)).toEqual({ name: 'New' });
  });

  it('archives a project via DELETE', async () => {
    fetchMock.mockResolvedValueOnce(res(204));
    await archiveProject('o1', 'p1');
    const [url, init] = fetchMock.mock.calls[0];
    expect(url).toContain('/organizations/o1/projects/p1');
    expect(init.method).toBe('DELETE');
  });

  it('adds a project member via POST', async () => {
    fetchMock.mockResolvedValueOnce(res(201, { id: 'pm1' }));
    await addProjectMember('o1', 'p1', { identifier: 'bob', role: 'MEMBER' });
    const [url, init] = fetchMock.mock.calls[0];
    expect(url).toContain('/organizations/o1/projects/p1/members');
    expect(init.method).toBe('POST');
    expect(JSON.parse(init.body)).toEqual({ identifier: 'bob', role: 'MEMBER' });
  });

  it('changes a project member role via PATCH', async () => {
    fetchMock.mockResolvedValueOnce(res(200, { id: 'pm1' }));
    await changeProjectMemberRole('o1', 'p1', 'u2', 'ADMIN');
    const [url, init] = fetchMock.mock.calls[0];
    expect(url).toContain('/organizations/o1/projects/p1/members/u2/role');
    expect(init.method).toBe('PATCH');
    expect(JSON.parse(init.body)).toEqual({ role: 'ADMIN' });
  });

  it('removes a project member via DELETE', async () => {
    fetchMock.mockResolvedValueOnce(res(204));
    await removeProjectMember('o1', 'p1', 'u2');
    const [url, init] = fetchMock.mock.calls[0];
    expect(url).toContain('/organizations/o1/projects/p1/members/u2');
    expect(init.method).toBe('DELETE');
  });
});

describe('project role helpers (UX gating)', () => {
  it('only org owner/admin can create projects', () => {
    expect(canCreateProject('OWNER')).toBe(true);
    expect(canCreateProject('ADMIN')).toBe(true);
    expect(canCreateProject('MEMBER')).toBe(false);
    expect(canCreateProject('VIEWER')).toBe(false);
  });

  it('only effective project admin can manage', () => {
    expect(canManageProject('ADMIN')).toBe(true);
    expect(canManageProject('MEMBER')).toBe(false);
    expect(canManageProject('VIEWER')).toBe(false);
    expect(canManageProject(null)).toBe(false);
  });
});
