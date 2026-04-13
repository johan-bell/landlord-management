import {
  CanActivate,
  ExecutionContext,
  ForbiddenException,
  Injectable,
} from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service';
import type { RequestUser } from '../types/jwt-payload';

@Injectable()
export class OrgMembershipGuard implements CanActivate {
  constructor(private readonly prisma: PrismaService) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const req = context
      .switchToHttp()
      .getRequest<{ params: { orgId?: string }; user: RequestUser }>();
    const user = req.user;
    const orgId = req.params.orgId;

    if (!orgId) {
      return true;
    }

    if (user.typ === 'platform') {
      return true;
    }

    if (user.typ !== 'staff') {
      throw new ForbiddenException('Staff access required');
    }

    const org = await this.prisma.organization.findUnique({
      where: { id: orgId },
    });
    if (!org) {
      throw new ForbiddenException('Organization not found');
    }

    if (org.suspendedAt) {
      throw new ForbiddenException('This organization is suspended');
    }

    const member = await this.prisma.organizationMember.findUnique({
      where: {
        userId_organizationId: { userId: user.userId, organizationId: orgId },
      },
    });

    if (!member) {
      throw new ForbiddenException('You are not a member of this organization');
    }

    return true;
  }
}
