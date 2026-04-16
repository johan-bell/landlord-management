import { Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { CreateOrganizationDto } from './dto/create-organization.dto';
import { UpdateOrganizationDto } from './dto/update-organization.dto';

function csvEscapeCell(value: string): string {
    if (/[",\n\r]/.test(value)) {
        return `"${value.replace(/"/g, '""')}"`;
    }
    return value;
}

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

    async findAllForUser(userId: string) {
        const rows = await this.prisma.organization.findMany({
            where: {
                members: { some: { userId } },
                suspendedAt: null,
            },
            orderBy: { createdAt: 'desc' },
            include: {
                members: {
                    where: { userId },
                    select: { role: true },
                    take: 1,
                },
            },
        });
        return rows.map(({ members, ...org }) => ({
            ...org,
            myRole: members[0]!.role,
        }));
    }

    async findOneOrThrow(id: string) {
        const org = await this.prisma.organization.findUnique({
            where: { id },
        });
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
                this.prisma.property.count({
                    where: { organizationId: orgId },
                }),
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

    async getOnboardingStatus(orgId: string) {
        await this.findOneOrThrow(orgId);
        const [
            propertyCount,
            unitCount,
            renterCount,
            leaseCount,
            memberCount,
            pendingTenantSignups,
        ] = await Promise.all([
            this.prisma.property.count({ where: { organizationId: orgId } }),
            this.prisma.unit.count({
                where: { property: { organizationId: orgId } },
            }),
            this.prisma.renter.count({ where: { organizationId: orgId } }),
            this.prisma.lease.count({
                where: { unit: { property: { organizationId: orgId } } },
            }),
            this.prisma.organizationMember.count({
                where: { organizationId: orgId },
            }),
            this.prisma.tenantSignupRequest.count({
                where: { organizationId: orgId, status: 'PENDING' },
            }),
        ]);

        const steps = [
            {
                id: 'properties',
                label: 'Add a property',
                description: 'Create your first building or site in the portfolio.',
                done: propertyCount > 0,
                route: '/properties',
            },
            {
                id: 'units',
                label: 'Add units & rent',
                description: 'Define units, rent amounts, and utility billing.',
                done: unitCount > 0,
                route: '/properties',
            },
            {
                id: 'people',
                label: 'Onboard renters',
                description:
                    pendingTenantSignups > 0
                        ? `${pendingTenantSignups} tenant signup(s) awaiting approval.`
                        : 'Add renters or approve tenant signups.',
                done: renterCount > 0,
                route: '/renters',
            },
            {
                id: 'leases',
                label: 'Record a lease',
                description: 'Link renters to units with lease terms.',
                done: leaseCount > 0,
                route: '/leases',
            },
            {
                id: 'team',
                label: 'Invite your team',
                description: 'Add managers or staff to help run day-to-day work.',
                done: memberCount > 1,
                route: '/team',
            },
        ];

        const doneCount = steps.filter((s) => s.done).length;
        return {
            organizationId: orgId,
            pendingTenantSignups,
            steps,
            completedSteps: doneCount,
            totalSteps: steps.length,
            completionPercent: Math.round((doneCount / steps.length) * 100),
        };
    }

    async buildRentRollCsv(orgId: string): Promise<string> {
        await this.findOneOrThrow(orgId);
        const leases = await this.prisma.lease.findMany({
            where: { unit: { property: { organizationId: orgId } } },
            include: {
                renter: true,
                unit: { include: { property: true } },
            },
            orderBy: [
                { unit: { property: { name: 'asc' } } },
                { unit: { label: 'asc' } },
                { startDate: 'desc' },
            ],
        });

        const header = [
            'Property',
            'Unit',
            'Renter name',
            'Renter phone',
            'Renter email',
            'Rent amount',
            'Currency',
            'Lease start',
            'Lease end',
            'Lease id',
        ];

        const lines = [header.join(',')];
        for (const l of leases) {
            const row = [
                l.unit.property.name,
                l.unit.label,
                l.renter.fullName,
                l.renter.phone ?? '',
                l.renter.email ?? '',
                l.rentAmount.toString(),
                l.currency,
                l.startDate.toISOString().slice(0, 10),
                l.endDate ? l.endDate.toISOString().slice(0, 10) : '',
                l.id,
            ].map((c) => csvEscapeCell(String(c)));
            lines.push(row.join(','));
        }

        return `\uFEFF${lines.join('\n')}\n`;
    }
}
