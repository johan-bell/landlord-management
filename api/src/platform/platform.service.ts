import { Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';

@Injectable()
export class PlatformService {
    constructor(private readonly prisma: PrismaService) {}

    listOrganizations() {
        return this.prisma.organization.findMany({
            orderBy: { createdAt: 'desc' },
            include: {
                _count: {
                    select: { members: true, properties: true, renters: true },
                },
            },
        });
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
}
