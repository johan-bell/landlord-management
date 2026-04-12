import { Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { OrganizationsService } from '../organizations/organizations.service';
import { CreatePropertyDto } from './dto/create-property.dto';
import { UpdatePropertyDto } from './dto/update-property.dto';

@Injectable()
export class PropertiesService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly organizationsService: OrganizationsService,
  ) {}

  async create(orgId: string, dto: CreatePropertyDto) {
    await this.organizationsService.findOneOrThrow(orgId);
    return this.prisma.property.create({
      data: {
        organizationId: orgId,
        name: dto.name,
        address: dto.address,
      },
    });
  }

  async findAll(orgId: string) {
    await this.organizationsService.findOneOrThrow(orgId);
    return this.prisma.property.findMany({
      where: { organizationId: orgId },
      orderBy: { name: 'asc' },
    });
  }

  async findOne(orgId: string, propertyId: string) {
    const property = await this.prisma.property.findFirst({
      where: { id: propertyId, organizationId: orgId },
    });
    if (!property) {
      throw new NotFoundException(`Property ${propertyId} not found in organization ${orgId}`);
    }
    return property;
  }

  async update(orgId: string, propertyId: string, dto: UpdatePropertyDto) {
    await this.findOne(orgId, propertyId);
    return this.prisma.property.update({
      where: { id: propertyId },
      data: dto,
    });
  }

  async remove(orgId: string, propertyId: string) {
    await this.findOne(orgId, propertyId);
    return this.prisma.property.delete({ where: { id: propertyId } });
  }
}
