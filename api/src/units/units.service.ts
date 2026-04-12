import { Injectable, NotFoundException } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';
import { PropertiesService } from '../properties/properties.service';
import { CreateUnitDto } from './dto/create-unit.dto';
import { UpdateUnitDto } from './dto/update-unit.dto';

@Injectable()
export class UnitsService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly propertiesService: PropertiesService,
  ) {}

  async create(orgId: string, propertyId: string, dto: CreateUnitDto) {
    await this.propertiesService.findOne(orgId, propertyId);
    return this.prisma.unit.create({
      data: {
        propertyId,
        label: dto.label,
        rentAmount: new Prisma.Decimal(dto.rentAmount),
        currency: dto.currency ?? 'XAF',
      },
    });
  }

  async findAll(orgId: string, propertyId: string) {
    await this.propertiesService.findOne(orgId, propertyId);
    return this.prisma.unit.findMany({
      where: { propertyId },
      orderBy: { label: 'asc' },
    });
  }

  async findOne(orgId: string, propertyId: string, unitId: string) {
    const unit = await this.prisma.unit.findFirst({
      where: {
        id: unitId,
        propertyId,
        property: { organizationId: orgId },
      },
    });
    if (!unit) {
      throw new NotFoundException(`Unit ${unitId} not found`);
    }
    return unit;
  }

  async update(orgId: string, propertyId: string, unitId: string, dto: UpdateUnitDto) {
    await this.findOne(orgId, propertyId, unitId);
    const data: Prisma.UnitUpdateInput = { ...dto };
    if (dto.rentAmount !== undefined) {
      data.rentAmount = new Prisma.Decimal(dto.rentAmount);
    }
    return this.prisma.unit.update({
      where: { id: unitId },
      data,
    });
  }

  async remove(orgId: string, propertyId: string, unitId: string) {
    await this.findOne(orgId, propertyId, unitId);
    return this.prisma.unit.delete({ where: { id: unitId } });
  }
}
