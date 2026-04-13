import {
    BadRequestException,
    Injectable,
    NotFoundException,
} from '@nestjs/common';
import {
    ElectricityBilling,
    Prisma,
    WaterBilling,
    type Unit,
} from '@prisma/client';
import {
    PaginationQueryDto,
    parsePagination,
    toPaginated,
} from '../common/dto/pagination-query.dto';
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
        const utilities = this.utilitiesForCreate(dto);
        return this.prisma.unit.create({
            data: {
                propertyId,
                label: dto.label,
                rentAmount: new Prisma.Decimal(dto.rentAmount),
                currency: dto.currency ?? 'XAF',
                ...utilities,
            },
        });
    }

    async findAll(
        orgId: string,
        propertyId: string,
        query?: PaginationQueryDto,
    ) {
        await this.propertiesService.findOne(orgId, propertyId);
        const { page, limit, skip } = parsePagination(query);
        const search = query?.search?.trim();
        const where: Prisma.UnitWhereInput = {
            propertyId,
            ...(search
                ? {
                      label: { contains: search, mode: 'insensitive' },
                  }
                : {}),
        };
        const [total, items] = await Promise.all([
            this.prisma.unit.count({ where }),
            this.prisma.unit.findMany({
                where,
                orderBy: { label: 'asc' },
                skip,
                take: limit,
            }),
        ]);
        return toPaginated(items, total, page, limit);
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

    async update(
        orgId: string,
        propertyId: string,
        unitId: string,
        dto: UpdateUnitDto,
    ) {
        const current = await this.findOne(orgId, propertyId, unitId);
        const utilities = this.utilitiesForUpdate(dto, current);
        const data: Prisma.UnitUpdateInput = {
            ...utilities,
        };
        if (dto.label !== undefined) data.label = dto.label;
        if (dto.rentAmount !== undefined) {
            data.rentAmount = new Prisma.Decimal(dto.rentAmount);
        }
        if (dto.currency !== undefined) data.currency = dto.currency;
        return this.prisma.unit.update({
            where: { id: unitId },
            data,
        });
    }

    async remove(orgId: string, propertyId: string, unitId: string) {
        await this.findOne(orgId, propertyId, unitId);
        return this.prisma.unit.delete({ where: { id: unitId } });
    }

    private utilitiesForCreate(dto: CreateUnitDto) {
        const electricityBilling =
            dto.electricityBilling ?? ElectricityBilling.PREPAID_EXTERNAL;
        const waterBilling = dto.waterBilling ?? WaterBilling.NONE;

        let electricityPricePerKwh: Prisma.Decimal | null = null;
        if (electricityBilling === ElectricityBilling.METERED_KWH) {
            if (
                dto.electricityPricePerKwh == null ||
                dto.electricityPricePerKwh <= 0
            ) {
                throw new BadRequestException(
                    'electricityPricePerKwh is required (greater than 0) when electricity is billed per kWh',
                );
            }
            electricityPricePerKwh = new Prisma.Decimal(
                dto.electricityPricePerKwh,
            );
        }

        let waterPricePerM3: Prisma.Decimal | null = null;
        if (waterBilling === WaterBilling.METERED_M3) {
            if (dto.waterPricePerM3 == null || dto.waterPricePerM3 <= 0) {
                throw new BadRequestException(
                    'waterPricePerM3 is required (greater than 0) when water is billed per m³',
                );
            }
            waterPricePerM3 = new Prisma.Decimal(dto.waterPricePerM3);
        }

        return {
            electricityBilling,
            electricityPricePerKwh,
            waterBilling,
            waterPricePerM3,
        };
    }

    private utilitiesForUpdate(dto: UpdateUnitDto, current: Unit) {
        const electricityBilling =
            dto.electricityBilling ?? current.electricityBilling;
        const waterBilling = dto.waterBilling ?? current.waterBilling;

        let electricityPricePerKwh: Prisma.Decimal | null =
            current.electricityPricePerKwh;
        if (dto.electricityPricePerKwh !== undefined) {
            electricityPricePerKwh =
                dto.electricityPricePerKwh === null
                    ? null
                    : new Prisma.Decimal(dto.electricityPricePerKwh);
        }

        let waterPricePerM3: Prisma.Decimal | null = current.waterPricePerM3;
        if (dto.waterPricePerM3 !== undefined) {
            waterPricePerM3 =
                dto.waterPricePerM3 === null
                    ? null
                    : new Prisma.Decimal(dto.waterPricePerM3);
        }

        if (electricityBilling === ElectricityBilling.PREPAID_EXTERNAL) {
            electricityPricePerKwh = null;
        }
        if (waterBilling === WaterBilling.NONE) {
            waterPricePerM3 = null;
        }

        if (electricityBilling === ElectricityBilling.METERED_KWH) {
            if (
                !electricityPricePerKwh ||
                electricityPricePerKwh.lte(new Prisma.Decimal(0))
            ) {
                throw new BadRequestException(
                    'electricityPricePerKwh is required (greater than 0) when electricity is billed per kWh',
                );
            }
        }

        if (waterBilling === WaterBilling.METERED_M3) {
            if (
                !waterPricePerM3 ||
                waterPricePerM3.lte(new Prisma.Decimal(0))
            ) {
                throw new BadRequestException(
                    'waterPricePerM3 is required (greater than 0) when water is billed per m³',
                );
            }
        }

        return {
            electricityBilling,
            electricityPricePerKwh,
            waterBilling,
            waterPricePerM3,
        };
    }
}
