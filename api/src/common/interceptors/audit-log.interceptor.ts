import {
    CallHandler,
    ExecutionContext,
    Injectable,
    NestInterceptor,
} from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import type { Request } from 'express';
import { Observable } from 'rxjs';
import { tap } from 'rxjs/operators';
import { AuditService } from '../../audit/audit.service';
import {
    AUDIT_LOG_KEY,
    type AuditLogMeta,
} from '../decorators/audit-log.decorator';

@Injectable()
export class AuditLogInterceptor implements NestInterceptor {
    constructor(
        private readonly reflector: Reflector,
        private readonly audit: AuditService,
    ) {}

    intercept(
        context: ExecutionContext,
        next: CallHandler,
    ): Observable<unknown> {
        const meta = this.reflector.get<AuditLogMeta | undefined>(
            AUDIT_LOG_KEY,
            context.getHandler(),
        );

        if (!meta) return next.handle();

        const req = context.switchToHttp().getRequest<Request>();
        const user = (req as Request & { user?: { userId?: string } }).user;
        const params = req.params as Record<string, string>;

        const orgIdParam = meta.orgIdParam ?? 'orgId';
        const organizationId = params[orgIdParam] ?? null;
        const entityId = meta.entityIdParam
            ? (params[meta.entityIdParam] ?? null)
            : null;
        const actorUserId = user?.userId ?? null;

        return next.handle().pipe(
            tap(() => {
                void this.audit.record({
                    organizationId,
                    actorUserId,
                    action: meta.action,
                    entityType: meta.entityType,
                    entityId,
                });
            }),
        );
    }
}
