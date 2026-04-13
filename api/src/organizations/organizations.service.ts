import { Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { CreateOrganizationDto } from './dto/create-organization.dto';
import { UpdateOrganizationDto } from './dto/update-organization.dto';

@Injectable()
export class OrganizationsService {
  constructor(private readonly prisma: PrismaService) {}

  async createForUser(userId: string, dto: CreateOrganizationDto) {
    return this.prisma.$transaction(async (tx) => {
      const org = await tx.organization.create({
        data: {
          name: dto.name,
          slug: dto.slug,
        },
      });
      await tx.organizationMember.create({
        data: {
          userId,
          organizationId: org.id,
          role: 'OWNER',
        },
      });
      return org;
    });
  }

  findAllForUser(userId: string) {
    return this.prisma.organization.findMany({
      where: {
        members: { some: { userId } },
        suspendedAt: null,
      },
      orderBy: { createdAt: 'desc' },
    });
  }

  async findOneOrThrow(id: string) {
    const org = await this.prisma.organization.findUnique({ where: { id } });
    if (!org) {
      throw new NotFoundException(`Organization ${id} not found`);
    }
    return org;
  }

  async update(id: string, dto: UpdateOrganizationDto) {
    await this.findOneOrThrow(id);
    return this.prisma.organization.update({
      where: { id },
      data: dto,
    });
  }

  async remove(id: string) {
    await this.findOneOrThrow(id);
    return this.prisma.organization.delete({ where: { id } });
  }

  async summary(orgId: string) {
    await this.findOneOrThrow(orgId);
    const [propertyCount, unitCount, renterCount, leaseCount] =
      await Promise.all([
        this.prisma.property.count({ where: { organizationId: orgId } }),
        this.prisma.unit.count({
          where: { property: { organizationId: orgId } },
        }),
        this.prisma.renter.count({ where: { organizationId: orgId } }),
        this.prisma.lease.count({
          where: {
            unit: { property: { organizationId: orgId } },
          },
        }),
      ]);

    const occupied = await this.prisma.unit.count({
      where: {
        property: { organizationId: orgId },
        status: 'OCCUPIED',
      },
    });

    return {
      organizationId: orgId,
      propertyCount,
      unitCount,
      occupiedUnitCount: occupied,
      vacantUnitCount: unitCount - occupied,
      renterCount,
      leaseCount,
    };
  }
}
