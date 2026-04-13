import {
    CanActivate,
    ExecutionContext,
    ForbiddenException,
    Injectable,
} from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service';
import type { RequestUser } from '../types/jwt-payload';

@Injectable()
export class PlatformAdminGuard implements CanActivate {
    constructor(private readonly prisma: PrismaService) {}

    async canActivate(context: ExecutionContext): Promise<boolean> {
        const req = context.switchToHttp().getRequest<{ user: RequestUser }>();
        const user = req.user;

        if (user.typ === 'tenant') {
            throw new ForbiddenException(
                'Tenant cannot access platform routes',
            );
        }

        const dbUser = await this.prisma.user.findUnique({
            where: { id: user.userId },
        });
        if (!dbUser?.isPlatformAdmin) {
            throw new ForbiddenException('Platform admin only');
        }

        return true;
    }
}
