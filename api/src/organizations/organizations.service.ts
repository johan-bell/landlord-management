import { Injectable, NotFoundException } from '@nestjs/common';
import { PaymentStatus } from '@prisma/client';
import { AuditService } from '../audit/audit.service';
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
    constructor(
        private readonly prisma: PrismaService,
        private readonly audit: AuditService,
    ) {}

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
            myRole: members[0].role,
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

    async update(id: string, dto: UpdateOrganizationDto, actorUserId?: string) {
        await this.findOneOrThrow(id);
        const updated = await this.prisma.organization.update({
            where: { id },
            data: dto,
        });
        if (actorUserId) {
            void this.audit.record({
                organizationId: id,
                actorUserId,
                action: 'organization.update',
                entityType: 'Organization',
                entityId: id,
                metadata: { patch: dto },
            });
        }
        return updated;
    }

    async remove(id: string, actorUserId?: string) {
        await this.findOneOrThrow(id);
        const deleted = await this.prisma.organization.delete({
            where: { id },
        });
        if (actorUserId) {
            void this.audit.record({
                organizationId: id,
                actorUserId,
                action: 'organization.delete',
                entityType: 'Organization',
                entityId: id,
            });
        }
        return deleted;
    }

    async analytics(orgId: string) {
        await this.findOneOrThrow(orgId);
        const now = new Date();
        const unitCount = await this.prisma.unit.count({
            where: { property: { organizationId: orgId } },
        });
        const vacantCount = await this.prisma.unit.count({
            where: {
                property: { organizationId: orgId },
                status: 'VACANT',
            },
        });
        const vacancyRate =
            unitCount === 0
                ? 0
                : Math.round((vacantCount / unitCount) * 1000) / 1000;

        const thirtyAgo = new Date(now.getTime() - 30 * 86400000);
        const payments30 = await this.prisma.payment.findMany({
            where: {
                lease: { unit: { property: { organizationId: orgId } } },
                dueDate: { gte: thirtyAgo, lte: now },
            },
            select: { amount: true, currency: true, status: true },
        });
        let dueSum = 0;
        let paidSum = 0;
        const byCurrency: Record<string, { due: number; paid: number }> = {};
        for (const p of payments30) {
            const c = p.currency || 'XAF';
            if (!byCurrency[c]) {
                byCurrency[c] = { due: 0, paid: 0 };
            }
            const amt = Number(p.amount);
            dueSum += amt;
            byCurrency[c].due += amt;
            if (p.status === PaymentStatus.PAID) {
                paidSum += amt;
                byCurrency[c].paid += amt;
            }
        }
        const collectionRateLast30Days =
            dueSum === 0 ? null : Math.round((paidSum / dueSum) * 1000) / 1000;

        const startTodayUtc = Date.UTC(
            now.getUTCFullYear(),
            now.getUTCMonth(),
            now.getUTCDate(),
        );
        const overdue = await this.prisma.payment.findMany({
            where: {
                status: { in: [PaymentStatus.PENDING, PaymentStatus.LATE] },
                dueDate: { lt: new Date(startTodayUtc) },
                lease: { unit: { property: { organizationId: orgId } } },
            },
            select: { amount: true, currency: true, dueDate: true },
        });

        type BucketKey = '0_30' | '31_60' | '61_90' | '91_plus';
        const arrears: Record<
            BucketKey,
            { paymentCount: number; totalAmount: number }
        > = {
            '0_30': { paymentCount: 0, totalAmount: 0 },
            '31_60': { paymentCount: 0, totalAmount: 0 },
            '61_90': { paymentCount: 0, totalAmount: 0 },
            '91_plus': { paymentCount: 0, totalAmount: 0 },
        };

        const msDay = 86400000;
        for (const p of overdue) {
            const days = Math.floor(
                (startTodayUtc - p.dueDate.getTime()) / msDay,
            );
            const amt = Number(p.amount);
            let key: BucketKey;
            if (days <= 30) {
                key = '0_30';
            } else if (days <= 60) {
                key = '31_60';
            } else if (days <= 90) {
                key = '61_90';
            } else {
                key = '91_plus';
            }
            arrears[key].paymentCount += 1;
            arrears[key].totalAmount += amt;
        }

        return {
            organizationId: orgId,
            unitCount,
            vacantUnitCount: vacantCount,
            vacancyRate,
            collectionRateLast30Days,
            rentRollLast30Days: {
                totalDue: dueSum,
                totalPaid: paidSum,
                byCurrency,
            },
            arrearsAgingDays: arrears,
            overduePaymentCount: overdue.length,
        };
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
                description:
                    'Create your first building or site in the portfolio.',
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
                description:
                    'Add managers or staff to help run day-to-day work.',
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
