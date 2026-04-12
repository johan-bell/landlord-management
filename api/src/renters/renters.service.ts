import { Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { OrganizationsService } from '../organizations/organizations.service';
import { CreateRenterDto } from './dto/create-renter.dto';
import { UpdateRenterDto } from './dto/update-renter.dto';

@Injectable()
export class RentersService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly organizationsService: OrganizationsService,
  ) {}

  async create(orgId: string, dto: CreateRenterDto) {
    await this.organizationsService.findOneOrThrow(orgId);
    return this.prisma.renter.create({
      data: {
        organizationId: orgId,
        fullName: dto.fullName,
        phone: dto.phone,
        email: dto.email,
        idDocument: dto.idDocument,
        notes: dto.notes,
      },
    });
  }

  async findAll(orgId: string) {
    await this.organizationsService.findOneOrThrow(orgId);
    return this.prisma.renter.findMany({
      where: { organizationId: orgId },
      orderBy: { fullName: 'asc' },
    });
  }

  async findOne(orgId: string, renterId: string) {
    const renter = await this.prisma.renter.findFirst({
      where: { id: renterId, organizationId: orgId },
    });
    if (!renter) {
      throw new NotFoundException(`Renter ${renterId} not found`);
    }
    return renter;
  }

  async update(orgId: string, renterId: string, dto: UpdateRenterDto) {
    await this.findOne(orgId, renterId);
    return this.prisma.renter.update({
      where: { id: renterId },
      data: dto,
    });
  }

  async remove(orgId: string, renterId: string) {
    await this.findOne(orgId, renterId);
    return this.prisma.renter.delete({ where: { id: renterId } });
  }
}
