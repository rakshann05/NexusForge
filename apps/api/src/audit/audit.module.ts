import { Global, Injectable, Module } from '@nestjs/common';
import { PrismaService } from '../common/prisma.module';
import type { Prisma } from '@prisma/client';

@Injectable()
export class AuditService {
  constructor(private readonly prisma: PrismaService) {}
  record(input: { organizationId?: string; actorId?: string; action: string; entityType: string; entityId: string; metadata?: Prisma.InputJsonValue }) {
    return this.prisma.auditLog.create({ data: { ...input, metadata: input.metadata ?? undefined } });
  }
}

@Global()
@Module({ providers: [AuditService], exports: [AuditService] })
export class AuditModule {}
