import { ConflictException, NotFoundException } from '@nestjs/common';
import { DocumentsService } from './documents.service';

const audit = () => ({ record: jest.fn().mockResolvedValue(undefined) });
const doc = { id: 'd1', title: 'Doc', content: 'body', organizationId: 'o1', createdAt: new Date(), updatedAt: new Date('2026-01-01T00:00:00Z') };

describe('DocumentsService', () => {
  it('creates a document together with its first revision and audits it', async () => {
    const a = audit();
    const prisma = { document: { create: jest.fn().mockResolvedValue(doc) } };
    const service = new DocumentsService(prisma as never, a as never);
    const result = await service.create('o1', { title: 'Doc', content: 'body' }, 'u1');
    expect(result.id).toBe('d1');
    expect(prisma.document.create).toHaveBeenCalledWith(
      expect.objectContaining({ data: expect.objectContaining({ revisions: { create: { title: 'Doc', content: 'body', authorId: 'u1' } } }) }),
    );
    expect(a.record).toHaveBeenCalledWith(expect.objectContaining({ action: 'document.created' }));
  });

  it('searches by title/content within the organization', async () => {
    const prisma = { document: { findMany: jest.fn().mockResolvedValue([]) } };
    const service = new DocumentsService(prisma as never, audit() as never);
    await service.list('o1', 'kafka');
    const where = prisma.document.findMany.mock.calls[0][0].where;
    expect(where.organizationId).toBe('o1');
    expect(where.OR).toEqual([
      { title: { contains: 'kafka', mode: 'insensitive' } },
      { content: { contains: 'kafka', mode: 'insensitive' } },
    ]);
  });

  it('rejects an update whose expectedUpdatedAt is stale (409 optimistic concurrency)', async () => {
    const prisma = { document: { findFirst: jest.fn().mockResolvedValue(doc) } };
    const service = new DocumentsService(prisma as never, audit() as never);
    await expect(
      service.update('o1', 'd1', { content: 'new', expectedUpdatedAt: '2020-01-01T00:00:00Z' }, 'u1'),
    ).rejects.toBeInstanceOf(ConflictException);
  });

  it('updates and snapshots a revision when the version matches', async () => {
    const a = audit();
    const prisma = {
      document: { findFirst: jest.fn().mockResolvedValue(doc), update: jest.fn().mockResolvedValue(doc) },
    };
    const service = new DocumentsService(prisma as never, a as never);
    await service.update('o1', 'd1', { content: 'new', expectedUpdatedAt: doc.updatedAt.toISOString() }, 'u1');
    expect(prisma.document.update).toHaveBeenCalledWith(
      expect.objectContaining({ data: expect.objectContaining({ revisions: { create: { title: 'Doc', content: 'new', authorId: 'u1' } } }) }),
    );
    expect(a.record).toHaveBeenCalledWith(expect.objectContaining({ action: 'document.updated' }));
  });

  it('404s on get for a document outside the organization', async () => {
    const prisma = { document: { findFirst: jest.fn().mockResolvedValue(null) } };
    const service = new DocumentsService(prisma as never, audit() as never);
    await expect(service.get('o1', 'ghost')).rejects.toBeInstanceOf(NotFoundException);
  });

  it('restores a revision and records it', async () => {
    const a = audit();
    const prisma = {
      documentRevision: { findFirst: jest.fn().mockResolvedValue({ id: 'r1', title: 'Old', content: 'old body', author: null, createdAt: new Date() }) },
      document: { update: jest.fn().mockResolvedValue(doc) },
    };
    const service = new DocumentsService(prisma as never, a as never);
    await service.restore('o1', 'd1', 'r1', 'u1');
    expect(prisma.document.update).toHaveBeenCalledWith(
      expect.objectContaining({ data: expect.objectContaining({ title: 'Old', content: 'old body' }) }),
    );
    expect(a.record).toHaveBeenCalledWith(expect.objectContaining({ action: 'document.restored' }));
  });
});
