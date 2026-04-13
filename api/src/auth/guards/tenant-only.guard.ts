import {
    CanActivate,
    ExecutionContext,
    ForbiddenException,
    Injectable,
} from '@nestjs/common';
import type { RequestUser } from '../types/jwt-payload';

@Injectable()
export class TenantOnlyGuard implements CanActivate {
    canActivate(context: ExecutionContext): boolean {
        const req = context.switchToHttp().getRequest<{ user: RequestUser }>();
        if (req.user?.typ !== 'tenant') {
            throw new ForbiddenException('Tenant access required');
        }
        return true;
    }
}
