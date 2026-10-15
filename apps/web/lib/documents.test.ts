import { canContributeDocs, createDocument, getDocument, listDocuments, restoreRevision, updateDocument } from './documents';
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

describe('document api wrappers', () => {
  it('lists documents and passes a search query', async () => {
    fetchMock.mockResolvedValueOnce(res(200, []));
    await listDocuments('o1', 'kafka notes');
    expect(String(fetchMock.mock.calls[0][0])).toContain('/organizations/o1/documents?q=kafka%20notes');
  });

  it('creates a document via POST', async () => {
    fetchMock.mockResolvedValueOnce(res(201, { id: 'd1' }));
    await createDocument('o1', { title: 'Doc' });
    const [url, init] = fetchMock.mock.calls[0];
    expect(url).toContain('/organizations/o1/documents');
    expect(init.method).toBe('POST');
    expect(JSON.parse(init.body)).toEqual({ title: 'Doc' });
  });

  it('gets a document scoped to org+id', async () => {
    fetchMock.mockResolvedValueOnce(res(200, { id: 'd1' }));
    await getDocument('o1', 'd1');
    expect(String(fetchMock.mock.calls[0][0])).toContain('/organizations/o1/documents/d1');
  });

  it('updates with an optimistic-concurrency token', async () => {
    fetchMock.mockResolvedValueOnce(res(200, { id: 'd1' }));
    await updateDocument('o1', 'd1', { content: 'x', expectedUpdatedAt: '2026-01-01T00:00:00.000Z' });
    const [url, init] = fetchMock.mock.calls[0];
    expect(url).toContain('/organizations/o1/documents/d1');
    expect(init.method).toBe('PATCH');
    expect(JSON.parse(init.body).expectedUpdatedAt).toBe('2026-01-01T00:00:00.000Z');
  });

  it('restores a revision via POST', async () => {
    fetchMock.mockResolvedValueOnce(res(200, { id: 'd1' }));
    await restoreRevision('o1', 'd1', 'r1');
    const [url, init] = fetchMock.mock.calls[0];
    expect(url).toContain('/organizations/o1/documents/d1/revisions/r1/restore');
    expect(init.method).toBe('POST');
  });

  it('gates document contribution to non-viewers', () => {
    expect(canContributeDocs('OWNER')).toBe(true);
    expect(canContributeDocs('MEMBER')).toBe(true);
    expect(canContributeDocs('VIEWER')).toBe(false);
  });
});
