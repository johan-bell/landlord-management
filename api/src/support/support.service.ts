import {
    ForbiddenException,
    Injectable,
    NotFoundException,
} from '@nestjs/common';
import { SupportRequestStatus } from '@prisma/client';
import type { RequestUser } from '../auth/types/jwt-payload';
import { OrgTeamService } from '../organizations/org-team.service';
import { PrismaService } from '../prisma/prisma.service';
import { CreateSupportRequestDto } from './dto/create-support-request.dto';
import { UpdateSupportRequestDto } from './dto/update-support-request.dto';

@Injectable()
export class SupportService {
    constructor(
        private readonly prisma: PrismaService,
        private readonly orgTeam: OrgTeamService,
    ) {}

    private async assertTenantCanUseOrg(
        user: RequestUser,
        organizationId: string,
    ) {
        const renter = await this.prisma.renter.findFirst({
            where: { userId: user.userId, organizationId },
        });
        if (renter) {
            return;
        }
        const signup = await this.prisma.tenantSignupRequest.findFirst({
            where: { userId: user.userId, organizationId, status: 'PENDING' },
        });
        if (signup) {
            return;
        }
        throw new ForbiddenException('Not linked to this organization');
    }

    async createForTenant(user: RequestUser, dto: CreateSupportRequestDto) {
        if (user.typ !== 'tenant') {
            throw new ForbiddenException();
        }
        const organizationId = dto.organizationId;
        if (!organizationId) {
            throw new ForbiddenException('organizationId is required');
        }
        await this.assertTenantCanUseOrg(user, organizationId);
        return this.prisma.supportRequest.create({
            data: {
                subject: dto.subject.trim(),
                message: dto.message.trim(),
                category: dto.category ?? 'GENERAL',
                urgency: dto.urgency ?? 'NORMAL',
                submitterId: user.userId,
                fromTenant: true,
                organizationId,
            },
            include: this.listInclude(),
        });
    }

    async createForOrgMember(
        orgId: string,
        actor: RequestUser,
        dto: CreateSupportRequestDto,
    ) {
        if (actor.typ === 'tenant') {
            throw new ForbiddenException();
        }
        await this.orgTeam.assertOrganizationAccess(orgId, actor);
        return this.prisma.supportRequest.create({
            data: {
                subject: dto.subject.trim(),
                message: dto.message.trim(),
                submitterId: actor.userId,
                fromTenant: false,
                organizationId: orgId,
            },
            include: this.listInclude(),
        });
    }

    private listInclude() {
        return {
            submitter: { select: { id: true, email: true, name: true } },
            organization: { select: { id: true, name: true } },
            handledBy: { select: { id: true, email: true, name: true } },
        } as const;
    }

    async listMineForTenant(user: RequestUser) {
        if (user.typ !== 'tenant') {
            throw new ForbiddenException();
        }
        return this.prisma.supportRequest.findMany({
            where: { submitterId: user.userId },
            orderBy: { createdAt: 'desc' },
            include: this.listInclude(),
        });
    }

    async listForOrganization(orgId: string, actor: RequestUser) {
        await this.orgTeam.assertOrganizationAccess(orgId, actor);
        return this.prisma.supportRequest.findMany({
            where: { organizationId: orgId },
            orderBy: { createdAt: 'desc' },
            include: this.listInclude(),
        });
    }

    async listForPlatform(filters: {
        status?: SupportRequestStatus;
        organizationId?: string;
    }) {
        return this.prisma.supportRequest.findMany({
            where: {
                ...(filters.status ? { status: filters.status } : {}),
                ...(filters.organizationId
                    ? { organizationId: filters.organizationId }
                    : {}),
            },
            orderBy: { createdAt: 'desc' },
            include: this.listInclude(),
        });
    }

    async updateByPlatform(
        requestId: string,
        handler: RequestUser,
        dto: UpdateSupportRequestDto,
    ) {
        const existing = await this.prisma.supportRequest.findUnique({
            where: { id: requestId },
        });
        if (!existing) {
            throw new NotFoundException('Support request not found');
        }
        let closedAt: Date | null | undefined;
        if (dto.status !== undefined) {
            if (
                dto.status === SupportRequestStatus.RESOLVED ||
                dto.status === SupportRequestStatus.CLOSED
            ) {
                closedAt = new Date();
            } else {
                closedAt = null;
            }
        }
        return this.prisma.supportRequest.update({
            where: { id: requestId },
            data: {
                ...(dto.status !== undefined ? { status: dto.status } : {}),
                ...(dto.resolutionNote !== undefined
                    ? { resolutionNote: dto.resolutionNote }
                    : {}),
                handledById: handler.userId,
                ...(closedAt !== undefined ? { closedAt } : {}),
            },
            include: this.listInclude(),
        });
    }
}
