import { Injectable } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { getRequestId } from '../common/request-context';
import { PrismaService } from '../prisma/prisma.service';

@Injectable()
export class AuditService {
    constructor(private readonly prisma: PrismaService) {}

    async record(params: {
        organizationId?: string | null;
        actorUserId?: string | null;
        action: string;
        entityType: string;
        entityId?: string | null;
        metadata?: Record<string, unknown> | null;
    }): Promise<void> {
        const requestId = getRequestId();
        const meta: Record<string, unknown> = { ...(params.metadata ?? {}) };
        if (requestId) {
            meta.requestId = requestId;
        }
        await this.prisma.auditLog.create({
            data: {
                organizationId: params.organizationId ?? undefined,
                actorUserId: params.actorUserId ?? undefined,
                action: params.action,
                entityType: params.entityType,
                entityId: params.entityId ?? undefined,
                metadata:
                    Object.keys(meta).length > 0
                        ? (meta as Prisma.InputJsonValue)
                        : undefined,
            },
        });
    }

    async listForOrg(orgId: string, page: number, limit: number) {
        const safePage = Math.max(1, page);
        const safeLimit = Math.min(100, Math.max(1, limit));
        const skip = (safePage - 1) * safeLimit;
        const [items, total] = await Promise.all([
            this.prisma.auditLog.findMany({
                where: { organizationId: orgId },
                orderBy: { createdAt: 'desc' },
                skip,
                take: safeLimit,
            }),
            this.prisma.auditLog.count({ where: { organizationId: orgId } }),
        ]);
        return { items, total, page: safePage, limit: safeLimit };
    }
}
