import { BadRequestException, ConflictException, Injectable, NotFoundException } from '@nestjs/common';
import { AuditService } from '../audit/audit.module';
import { PrismaService } from '../common/prisma.module';

export type CreateDocumentInput = { title: string; content?: string };
export type UpdateDocumentInput = { title?: string; content?: string; expectedUpdatedAt?: string };

const authorSelect = { id: true, displayName: true, username: true, avatarUrl: true } as const;

@Injectable()
export class DocumentsService {
  constructor(private readonly prisma: PrismaService, private readonly audit: AuditService) {}

  /** List (summaries) or search by title/content within the organization. */
  async list(organizationId: string, q?: string) {
    const where = q
      ? {
          organizationId,
          OR: [
            { title: { contains: q, mode: 'insensitive' as const } },
            { content: { contains: q, mode: 'insensitive' as const } },
          ],
        }
      : { organizationId };
    return this.prisma.document.findMany({
      where,
      select: { id: true, title: true, createdAt: true, updatedAt: true },
      orderBy: { updatedAt: 'desc' },
      take: 200,
    });
  }

  async create(organizationId: string, dto: CreateDocumentInput, authorId: string) {
    const title = dto.title.trim();
    const content = dto.content ?? '';
    const document = await this.prisma.document.create({
      data: { organizationId, title, content, revisions: { create: { title, content, authorId } } },
      select: { id: true, title: true, content: true, organizationId: true, createdAt: true, updatedAt: true },
    });
    await this.audit.record({ organizationId, actorId: authorId, action: 'document.created', entityType: 'Document', entityId: document.id, metadata: { title } });
    return document;
  }

  async get(organizationId: string, documentId: string) {
    const document = await this.prisma.document.findFirst({
      where: { id: documentId, organizationId },
      select: {
        id: true, title: true, content: true, organizationId: true, createdAt: true, updatedAt: true,
        revisions: { take: 1, orderBy: { createdAt: 'desc' }, select: { author: { select: authorSelect }, createdAt: true } },
      },
    });
    if (!document) throw new NotFoundException('Document not found');
    const { revisions, ...rest } = document;
    return { ...rest, updatedBy: revisions[0]?.author ?? null };
  }

  async update(organizationId: string, documentId: string, dto: UpdateDocumentInput, authorId: string) {
    const current = await this.prisma.document.findFirst({ where: { id: documentId, organizationId }, select: { id: true, title: true, content: true, updatedAt: true } });
    if (!current) throw new NotFoundException('Document not found');
    // Optimistic concurrency: refuse to overwrite a newer version than the client saw.
    if (dto.expectedUpdatedAt && new Date(dto.expectedUpdatedAt).getTime() !== current.updatedAt.getTime()) {
      throw new ConflictException('This document was updated by someone else. Reload to see the latest version.');
    }
    const title = dto.title !== undefined ? dto.title.trim() : current.title;
    const content = dto.content !== undefined ? dto.content : current.content;
    if (dto.title === undefined && dto.content === undefined) throw new BadRequestException('No changes provided.');
    const document = await this.prisma.document.update({
      where: { id: documentId },
      data: { title, content, revisions: { create: { title, content, authorId } } },
      select: { id: true, title: true, content: true, organizationId: true, createdAt: true, updatedAt: true },
    });
    await this.audit.record({ organizationId, actorId: authorId, action: 'document.updated', entityType: 'Document', entityId: documentId, metadata: { title } });
    return { ...document, updatedBy: null };
  }

  async remove(organizationId: string, documentId: string, actorId: string) {
    const document = await this.prisma.document.findFirst({ where: { id: documentId, organizationId }, select: { id: true } });
    if (!document) throw new NotFoundException('Document not found');
    await this.prisma.document.delete({ where: { id: documentId } });
    await this.audit.record({ organizationId, actorId, action: 'document.deleted', entityType: 'Document', entityId: documentId });
  }

  async listRevisions(organizationId: string, documentId: string) {
    await this.requireDocument(organizationId, documentId);
    return this.prisma.documentRevision.findMany({
      where: { documentId },
      select: { id: true, title: true, authorId: true, author: { select: authorSelect }, createdAt: true },
      orderBy: { createdAt: 'desc' },
      take: 100,
    });
  }

  async getRevision(organizationId: string, documentId: string, revisionId: string) {
    const revision = await this.prisma.documentRevision.findFirst({
      where: { id: revisionId, documentId, document: { organizationId } },
      select: { id: true, title: true, content: true, author: { select: authorSelect }, createdAt: true },
    });
    if (!revision) throw new NotFoundException('Revision not found');
    return revision;
  }

  async restore(organizationId: string, documentId: string, revisionId: string, authorId: string) {
    const revision = await this.getRevision(organizationId, documentId, revisionId);
    const document = await this.prisma.document.update({
      where: { id: documentId },
      data: { title: revision.title, content: revision.content, revisions: { create: { title: revision.title, content: revision.content, authorId } } },
      select: { id: true, title: true, content: true, organizationId: true, createdAt: true, updatedAt: true },
    });
    await this.audit.record({ organizationId, actorId: authorId, action: 'document.restored', entityType: 'Document', entityId: documentId, metadata: { fromRevision: revisionId } });
    return { ...document, updatedBy: null };
  }

  private async requireDocument(organizationId: string, documentId: string) {
    const document = await this.prisma.document.findFirst({ where: { id: documentId, organizationId }, select: { id: true } });
    if (!document) throw new NotFoundException('Document not found');
    return document;
  }
}
