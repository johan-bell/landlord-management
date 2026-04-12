import { Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';

@Injectable()
export class PlatformService {
  constructor(private readonly prisma: PrismaService) {}

  listOrganizations() {
    return this.prisma.organization.findMany({
      orderBy: { createdAt: 'desc' },
      include: {
        _count: { select: { members: true, properties: true, renters: true } },
      },
    });
  }

  async setSuspended(orgId: string, suspended: boolean) {
    const org = await this.prisma.organization.findUnique({ where: { id: orgId } });
    if (!org) {
      throw new NotFoundException('Organization not found');
    }
    return this.prisma.organization.update({
      where: { id: orgId },
      data: { suspendedAt: suspended ? new Date() : null },
    });
  }
}
