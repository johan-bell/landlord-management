import { Injectable, NotFoundException } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import {
    PaginationQueryDto,
    parsePagination,
    toPaginated,
} from '../common/dto/pagination-query.dto';
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

    async findAll(orgId: string, query?: PaginationQueryDto) {
        await this.organizationsService.findOneOrThrow(orgId);
        const { page, limit, skip } = parsePagination(query);
        const search = query?.search?.trim();
        const where: Prisma.PropertyWhereInput = {
            organizationId: orgId,
            ...(search
                ? {
                      OR: [
                          { name: { contains: search, mode: 'insensitive' } },
                          {
                              address: {
                                  contains: search,
                                  mode: 'insensitive',
                              },
                          },
                      ],
                  }
                : {}),
        };
        const [total, items] = await Promise.all([
            this.prisma.property.count({ where }),
            this.prisma.property.findMany({
                where,
                orderBy: { name: 'asc' },
                skip,
                take: limit,
            }),
        ]);
        return toPaginated(items, total, page, limit);
    }

    async findOne(orgId: string, propertyId: string) {
        const property = await this.prisma.property.findFirst({
            where: { id: propertyId, organizationId: orgId },
        });
        if (!property) {
            throw new NotFoundException(
                `Property ${propertyId} not found in organization ${orgId}`,
            );
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
