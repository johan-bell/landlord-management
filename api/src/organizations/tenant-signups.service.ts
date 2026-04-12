import { BadRequestException, Injectable, NotFoundException } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';
import { OrgTeamService } from './org-team.service';
import { ApproveTenantSignupDto } from './dto/approve-tenant-signup.dto';

@Injectable()
export class TenantSignupsService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly orgTeam: OrgTeamService,
  ) {}

  async listPending(orgId: string, actorUserId: string) {
    await this.orgTeam.assertTeamManager(orgId, actorUserId);
    return this.prisma.tenantSignupRequest.findMany({
      where: { organizationId: orgId, status: 'PENDING' },
      include: {
        user: { select: { id: true, email: true, name: true, phone: true, createdAt: true } },
      },
      orderBy: { createdAt: 'asc' },
    });
  }

  async reject(orgId: string, requestId: string, actorUserId: string) {
    await this.orgTeam.assertTeamManager(orgId, actorUserId);
    const req = await this.prisma.tenantSignupRequest.findFirst({
      where: { id: requestId, organizationId: orgId, status: 'PENDING' },
    });
    if (!req) {
      throw new NotFoundException('Request not found');
    }
    return this.prisma.tenantSignupRequest.update({
      where: { id: requestId },
      data: { status: 'REJECTED' },
    });
  }

  async approve(orgId: string, requestId: string, actorUserId: string, dto: ApproveTenantSignupDto) {
    await this.orgTeam.assertTeamManager(orgId, actorUserId);

    const signup = await this.prisma.tenantSignupRequest.findFirst({
      where: { id: requestId, organizationId: orgId, status: 'PENDING' },
      include: { user: { include: { renterProfile: true } } },
    });
    if (!signup) {
      throw new NotFoundException('Request not found');
    }

    const unit = await this.prisma.unit.findFirst({
      where: {
        id: dto.unitId,
        property: { organizationId: orgId },
      },
      include: { property: true },
    });
    if (!unit) {
      throw new NotFoundException(`Unit ${dto.unitId} not found in this organization`);
    }

    const open = await this.prisma.lease.findFirst({
      where: { unitId: dto.unitId, endDate: null },
    });
    if (open) {
      throw new BadRequestException(
        'This unit already has an open-ended lease. Set an end date on the existing lease first.',
      );
    }

    const start = new Date(dto.startDate);
    const end = dto.endDate ? new Date(dto.endDate) : null;
    if (end && end < start) {
      throw new BadRequestException('endDate must be on or after startDate');
    }

    if (signup.user.renterProfile) {
      throw new BadRequestException('User already has a renter profile');
    }

    const fullName = signup.user.name?.trim() || signup.user.email.split('@')[0];
    const email = signup.user.email;

    return this.prisma.$transaction(async (tx) => {
      const renter = await tx.renter.create({
        data: {
          organizationId: orgId,
          fullName,
          email,
          phone: signup.user.phone,
          userId: signup.userId,
        },
      });

      await tx.lease.create({
        data: {
          unitId: dto.unitId,
          renterId: renter.id,
          startDate: start,
          endDate: end,
          rentAmount: new Prisma.Decimal(dto.rentAmount),
          currency: dto.currency ?? 'XAF',
          dueDay: dto.dueDay ?? 1,
        },
      });

      await tx.unit.update({
        where: { id: dto.unitId },
        data: { status: 'OCCUPIED' },
      });

      await tx.tenantSignupRequest.delete({ where: { id: signup.id } });

      return { renterId: renter.id };
    });
  }
}
