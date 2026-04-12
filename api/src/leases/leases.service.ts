import {
  BadRequestException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';
import { OrganizationsService } from '../organizations/organizations.service';
import { RentersService } from '../renters/renters.service';
import { CreateLeaseDto } from './dto/create-lease.dto';
import { UpdateLeaseDto } from './dto/update-lease.dto';

@Injectable()
export class LeasesService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly organizationsService: OrganizationsService,
    private readonly rentersService: RentersService,
  ) {}

  private async getUnitInOrg(orgId: string, unitId: string) {
    const unit = await this.prisma.unit.findFirst({
      where: {
        id: unitId,
        property: { organizationId: orgId },
      },
      include: { property: true },
    });
    if (!unit) {
      throw new NotFoundException(`Unit ${unitId} not found in this organization`);
    }
    return unit;
  }

  async create(orgId: string, dto: CreateLeaseDto) {
    await this.organizationsService.findOneOrThrow(orgId);
    await this.rentersService.findOne(orgId, dto.renterId);
    await this.getUnitInOrg(orgId, dto.unitId);

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

    return this.prisma.$transaction(async (tx) => {
      const lease = await tx.lease.create({
        data: {
          unitId: dto.unitId,
          renterId: dto.renterId,
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
      return lease;
    });
  }

  async findAll(orgId: string) {
    await this.organizationsService.findOneOrThrow(orgId);
    return this.prisma.lease.findMany({
      where: { unit: { property: { organizationId: orgId } } },
      include: {
        unit: { include: { property: true } },
        renter: true,
        payments: { orderBy: { dueDate: 'desc' } },
      },
      orderBy: { startDate: 'desc' },
    });
  }

  async findOne(orgId: string, leaseId: string) {
    const lease = await this.prisma.lease.findFirst({
      where: {
        id: leaseId,
        unit: { property: { organizationId: orgId } },
      },
      include: {
        unit: { include: { property: true } },
        renter: true,
        payments: { orderBy: { dueDate: 'desc' } },
      },
    });
    if (!lease) {
      throw new NotFoundException(`Lease ${leaseId} not found`);
    }
    return lease;
  }

  async update(orgId: string, leaseId: string, dto: UpdateLeaseDto) {
    const existing = await this.findOne(orgId, leaseId);
    if (dto.unitId && dto.unitId !== existing.unitId) {
      throw new BadRequestException('Moving a lease to another unit is not supported in this version');
    }
    if (dto.renterId) {
      await this.rentersService.findOne(orgId, dto.renterId);
    }

    const data: Prisma.LeaseUpdateInput = {};
    if (dto.startDate !== undefined) data.startDate = new Date(dto.startDate);
    if (dto.endDate !== undefined) data.endDate = dto.endDate ? new Date(dto.endDate) : null;
    if (dto.rentAmount !== undefined) data.rentAmount = new Prisma.Decimal(dto.rentAmount);
    if (dto.currency !== undefined) data.currency = dto.currency;
    if (dto.dueDay !== undefined) data.dueDay = dto.dueDay;

    const start = dto.startDate !== undefined ? new Date(dto.startDate) : existing.startDate;
    const end =
      dto.endDate !== undefined
        ? dto.endDate
          ? new Date(dto.endDate)
          : null
        : existing.endDate;
    if (end && end < start) {
      throw new BadRequestException('endDate must be on or after startDate');
    }

    return this.prisma.$transaction(async (tx) => {
      const updated = await tx.lease.update({
        where: { id: leaseId },
        data,
        include: {
          unit: { include: { property: true } },
          renter: true,
        },
      });

      const effectiveEnd = updated.endDate;
      if (effectiveEnd && effectiveEnd < new Date()) {
        await tx.unit.update({
          where: { id: updated.unitId },
          data: { status: 'VACANT' },
        });
      }
      return updated;
    });
  }

  async remove(orgId: string, leaseId: string) {
    const lease = await this.findOne(orgId, leaseId);
    return this.prisma.$transaction(async (tx) => {
      await tx.lease.delete({ where: { id: leaseId } });
      await tx.unit.update({
        where: { id: lease.unitId },
        data: { status: 'VACANT' },
      });
      return { id: leaseId, deleted: true };
    });
  }
}
