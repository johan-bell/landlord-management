import { SetMetadata } from '@nestjs/common';

export const AUDIT_LOG_KEY = 'audit_log';

export type AuditLogMeta = {
    action: string;
    entityType: string;
    /** Optional: dot-path into route params to extract entityId, e.g. 'propertyId' */
    entityIdParam?: string;
    /** Optional: dot-path into route params for orgId (defaults to 'orgId') */
    orgIdParam?: string;
};

export const AuditLog = (
    action: string,
    entityType: string,
    opts?: Pick<AuditLogMeta, 'entityIdParam' | 'orgIdParam'>,
) =>
    SetMetadata<string, AuditLogMeta>(AUDIT_LOG_KEY, {
        action,
        entityType,
        entityIdParam: opts?.entityIdParam,
        orgIdParam: opts?.orgIdParam ?? 'orgId',
    });
