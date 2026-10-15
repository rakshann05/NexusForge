import { addTaskComment, canContributeProject, createTask, deleteTask, listTasks, moveTask, updateTask } from './tasks';
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

describe('task api wrappers', () => {
  it('lists tasks with filter query params', async () => {
    fetchMock.mockResolvedValueOnce(res(200, []));
    await listTasks('o1', 'p1', { status: 'TODO', assigneeId: 'u2' });
    const url = String(fetchMock.mock.calls[0][0]);
    expect(url).toContain('/organizations/o1/projects/p1/tasks');
    expect(url).toContain('status=TODO');
    expect(url).toContain('assigneeId=u2');
  });

  it('creates a task via POST', async () => {
    fetchMock.mockResolvedValueOnce(res(201, { id: 't1' }));
    await createTask('o1', 'p1', { title: 'T', priority: 'HIGH' });
    const [url, init] = fetchMock.mock.calls[0];
    expect(url).toContain('/organizations/o1/projects/p1/tasks');
    expect(init.method).toBe('POST');
    expect(JSON.parse(init.body)).toEqual({ title: 'T', priority: 'HIGH' });
  });

  it('moves a task via PATCH /move with status + position', async () => {
    fetchMock.mockResolvedValueOnce(res(200, { id: 't1' }));
    await moveTask('o1', 'p1', 't1', 'DONE', 42);
    const [url, init] = fetchMock.mock.calls[0];
    expect(url).toContain('/organizations/o1/projects/p1/tasks/t1/move');
    expect(init.method).toBe('PATCH');
    expect(JSON.parse(init.body)).toEqual({ status: 'DONE', position: 42 });
  });

  it('updates and deletes a task', async () => {
    fetchMock.mockResolvedValueOnce(res(200, { id: 't1' }));
    await updateTask('o1', 'p1', 't1', { title: 'New' });
    expect(fetchMock.mock.calls[0][1].method).toBe('PATCH');
    fetchMock.mockResolvedValueOnce(res(204));
    await deleteTask('o1', 'p1', 't1');
    expect(fetchMock.mock.calls[1][1].method).toBe('DELETE');
  });

  it('adds a comment via POST', async () => {
    fetchMock.mockResolvedValueOnce(res(201, { id: 'c1' }));
    await addTaskComment('o1', 'p1', 't1', 'hello');
    const [url, init] = fetchMock.mock.calls[0];
    expect(url).toContain('/organizations/o1/projects/p1/tasks/t1/comments');
    expect(JSON.parse(init.body)).toEqual({ body: 'hello' });
  });

  it('gates contribution to project admin/member', () => {
    expect(canContributeProject('ADMIN')).toBe(true);
    expect(canContributeProject('MEMBER')).toBe(true);
    expect(canContributeProject('VIEWER')).toBe(false);
    expect(canContributeProject(null)).toBe(false);
  });
});
