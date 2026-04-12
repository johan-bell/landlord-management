import { Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';

@Injectable()
export class TenantPortalService {
  constructor(private readonly prisma: PrismaService) {}

  async getMe(renterId: string) {
    const renter = await this.prisma.renter.findUnique({
      where: { id: renterId },
      include: {
        organization: true,
      },
    });
    if (!renter) {
      throw new NotFoundException();
    }
    return {
      renter: {
        id: renter.id,
        fullName: renter.fullName,
        phone: renter.phone,
        email: renter.email,
      },
      organization: {
        id: renter.organization.id,
        name: renter.organization.name,
      },
    };
  }

  async getLeases(renterId: string) {
    return this.prisma.lease.findMany({
      where: { renterId },
      include: {
        unit: { include: { property: true } },
        payments: { orderBy: { dueDate: 'desc' } },
      },
      orderBy: { startDate: 'desc' },
    });
  }
}
