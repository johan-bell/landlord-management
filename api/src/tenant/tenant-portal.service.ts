import { Injectable, NotFoundException } from '@nestjs/common';
import type { RequestUser } from '../auth/types/jwt-payload';
import { PrismaService } from '../prisma/prisma.service';

@Injectable()
export class TenantPortalService {
  constructor(private readonly prisma: PrismaService) {}

  async getMe(user: RequestUser) {
    let renterId = user.renterId;
    if (!renterId) {
      const linked = await this.prisma.renter.findUnique({
        where: { userId: user.userId },
        include: { organization: true },
      });
      if (linked) {
        return {
          status: 'active' as const,
          renter: {
            id: linked.id,
            fullName: linked.fullName,
            phone: linked.phone,
            email: linked.email,
          },
          organization: {
            id: linked.organization.id,
            name: linked.organization.name,
          },
        };
      }
    } else {
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
        status: 'active' as const,
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

    const signup = await this.prisma.tenantSignupRequest.findUnique({
      where: { userId: user.userId },
      include: { organization: true },
    });

    if (signup?.status === 'PENDING') {
      const u = await this.prisma.user.findUnique({ where: { id: user.userId } });
      if (!u) {
        throw new NotFoundException();
      }
      return {
        status: 'pending' as const,
        fullName: u.name,
        email: u.email,
        phone: u.phone,
        organization: {
          id: signup.organization.id,
          name: signup.organization.name,
        },
        message:
          'Your account is waiting for the landlord to assign your unit and approve access. You can sign out and come back later.',
      };
    }

    if (signup?.status === 'REJECTED') {
      return {
        status: 'rejected' as const,
        organization: {
          id: signup.organization.id,
          name: signup.organization.name,
        },
        message:
          'Your registration was not approved for this organization. Contact your landlord if you think this is a mistake.',
      };
    }

    throw new NotFoundException();
  }

  async getLeases(user: RequestUser) {
    let renterId = user.renterId;
    if (!renterId) {
      const r = await this.prisma.renter.findUnique({ where: { userId: user.userId } });
      renterId = r?.id;
    }
    if (!renterId) {
      return [];
    }
    return this.prisma.lease.findMany({
      where: { renterId },
      include: {
        unit: { include: { property: true } },
        payments: { orderBy: { dueDate: 'desc' } },
        utilityBills: {
          orderBy: [{ year: 'desc' }, { month: 'desc' }, { kind: 'asc' }],
          take: 60,
        },
      },
      orderBy: { startDate: 'desc' },
    });
  }
}
