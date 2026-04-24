import { Injectable, NotFoundException } from '@nestjs/common';
import { stripPlatformInternalNotes } from '../common/strip-platform-internal-notes';
import { PrismaService } from '../prisma/prisma.service';

@Injectable()
export class PlatformService {
    constructor(private readonly prisma: PrismaService) {}

    async listOrganizations() {
        const rows = await this.prisma.organization.findMany({
            orderBy: { createdAt: 'desc' },
            include: {
                _count: {
                    select: { members: true, properties: true, renters: true },
                },
            },
        });
        return rows.map((row) =>
            stripPlatformInternalNotes(
                row as typeof row & Record<string, unknown>,
            ),
        );
    }

    async setSuspended(orgId: string, suspended: boolean) {
        const org = await this.prisma.organization.findUnique({
            where: { id: orgId },
        });
        if (!org) {
            throw new NotFoundException('Organization not found');
        }
        return this.prisma.organization.update({
            where: { id: orgId },
            data: { suspendedAt: suspended ? new Date() : null },
        });
    }

    async setInternalNotes(orgId: string, notes: string | null) {
        const org = await this.prisma.organization.findUnique({
            where: { id: orgId },
        });
        if (!org) {
            throw new NotFoundException('Organization not found');
        }
        return this.prisma.organization.update({
            where: { id: orgId },
            data: {
                platformInternalNotes:
                    notes === null || notes === undefined
                        ? null
                        : notes.trim() || null,
            } as { platformInternalNotes: string | null },
        });
    }

    async getOrganization(orgId: string) {
        const org = await this.prisma.organization.findUnique({
            where: { id: orgId },
            include: {
                members: {
                    take: 40,
                    orderBy: { createdAt: 'desc' },
                    include: {
                        user: {
                            select: {
                                id: true,
                                email: true,
                                name: true,
                                phone: true,
                            },
                        },
                    },
                },
                _count: {
                    select: { members: true, properties: true, renters: true },
                },
            },
        });
        if (!org) {
            throw new NotFoundException('Organization not found');
        }

        const [unitCount, leaseCount, openInvites] = await Promise.all([
            this.prisma.unit.count({
                where: { property: { organizationId: orgId } },
            }),
            this.prisma.lease.count({
                where: { unit: { property: { organizationId: orgId } } },
            }),
            this.prisma.organizationInvitation.count({
                where: { organizationId: orgId, expiresAt: { gt: new Date() } },
            }),
        ]);

        return {
            ...org,
            diagnostics: {
                units: unitCount,
                leases: leaseCount,
                pendingInvitations: openInvites,
                members: org._count.members,
                properties: org._count.properties,
                renters: org._count.renters,
            },
        };
    }

    async getFleetHealthSnapshot() {
        const [
            totalOrgs,
            suspendedOrgs,
            activeWithoutProperties,
            subscriptionsPastDue,
            openSupportRequests,
            pendingTenantSignups,
            activeLeases,
            orgsWithStripeCustomer,
        ] = await Promise.all([
            this.prisma.organization.count(),
            this.prisma.organization.count({
                where: { suspendedAt: { not: null } },
            }),
            this.prisma.organization.count({
                where: {
                    suspendedAt: null,
                    properties: { none: {} },
                },
            }),
            this.prisma.organization.count({
                where: {
                    suspendedAt: null,
                    subscriptionStatus: 'PAST_DUE',
                },
            }),
            this.prisma.supportRequest.count({
                where: { status: { in: ['OPEN', 'IN_PROGRESS'] } },
            }),
            this.prisma.tenantSignupRequest.count({
                where: { status: 'PENDING' },
            }),
            this.prisma.lease.count({
                where: {
                    unit: { property: { organization: { suspendedAt: null } } },
                    OR: [{ endDate: null }, { endDate: { gte: new Date() } }],
                },
            }),
            this.prisma.organization.count({
                where: {
                    suspendedAt: null,
                    stripeCustomerId: { not: null },
                },
            }),
        ]);

        const activeOrgs = totalOrgs - suspendedOrgs;

        return {
            generatedAt: new Date().toISOString(),
            organizations: {
                total: totalOrgs,
                active: activeOrgs,
                suspended: suspendedOrgs,
            },
            operations: {
                activeOrgsWithoutProperties: activeWithoutProperties,
                subscriptionsPastDue,
                openSupportRequests,
                pendingTenantSignups,
            },
            revenueSignals: {
                activeLeaseAgreements: activeLeases,
                activeOrgsWithStripeCustomer: orgsWithStripeCustomer,
            },
        };
    }
}
