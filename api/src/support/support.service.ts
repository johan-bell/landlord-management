import {
    BadRequestException,
    ForbiddenException,
    Injectable,
    NotFoundException,
} from '@nestjs/common';
import { SupportRequestStatus } from '@prisma/client';
import type { RequestUser } from '../auth/types/jwt-payload';
import { OrgTeamService } from '../organizations/org-team.service';
import { PrismaService } from '../prisma/prisma.service';
import { ObjectStorageService } from '../storage/object-storage.service';
import { CreateSupportRequestDto } from './dto/create-support-request.dto';
import { UpdateSupportRequestDto } from './dto/update-support-request.dto';

@Injectable()
export class SupportService {
    constructor(
        private readonly prisma: PrismaService,
        private readonly orgTeam: OrgTeamService,
        private readonly storage: ObjectStorageService,
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
                category: dto.category ?? 'GENERAL',
                urgency: dto.urgency ?? 'NORMAL',
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
        return this.applySupportRequestUpdate(requestId, handler.userId, dto);
    }

    /**
     * Owner or manager (or platform via org route) may update tickets for their org.
     * Staff without those roles use read-only list/detail.
     */
    async updateByOrgManager(
        orgId: string,
        requestId: string,
        actor: RequestUser,
        dto: UpdateSupportRequestDto,
    ) {
        await this.orgTeam.assertTeamManagerOrPlatform(orgId, actor);
        const existing = await this.prisma.supportRequest.findFirst({
            where: { id: requestId, organizationId: orgId },
        });
        if (!existing) {
            throw new NotFoundException('Support request not found');
        }
        return this.applySupportRequestUpdate(requestId, actor.userId, dto);
    }

    async createPhotoUploadIntent(
        requestId: string,
        orgId: string,
        user: RequestUser,
        contentType: string,
    ) {
        this.storage.assertEnabled();
        const ticket = await this.prisma.supportRequest.findFirst({
            where: { id: requestId, submitterId: user.userId },
        });
        if (!ticket) {
            throw new NotFoundException('Support request not found');
        }
        if (ticket.photoObjectKey) {
            throw new BadRequestException('Photo already attached to this ticket');
        }
        const key = this.storage.buildSupportPhotoObjectKey(orgId, contentType);
        const uploadUrl = await this.storage.getPresignedPutUrl(key, contentType);
        return { uploadUrl, objectKey: key, expiresInSeconds: 900 };
    }

    async attachPhoto(
        requestId: string,
        user: RequestUser,
        orgId: string,
        objectKey: string,
        contentType: string,
    ) {
        this.storage.assertEnabled();
        if (!this.storage.supportPhotoKeyBelongsToOrg(orgId, objectKey)) {
            throw new BadRequestException('Invalid object key');
        }
        const ticket = await this.prisma.supportRequest.findFirst({
            where: { id: requestId, submitterId: user.userId },
        });
        if (!ticket) {
            throw new NotFoundException('Support request not found');
        }
        return this.prisma.supportRequest.update({
            where: { id: requestId },
            data: { photoObjectKey: objectKey, photoMimeType: contentType },
            include: this.listInclude(),
        });
    }

    async getPhotoViewUrl(requestId: string, orgId: string, actor: RequestUser) {
        await this.orgTeam.assertOrganizationAccess(orgId, actor);
        const ticket = await this.prisma.supportRequest.findFirst({
            where: { id: requestId, organizationId: orgId },
        });
        if (!ticket) {
            throw new NotFoundException('Support request not found');
        }
        if (!ticket.photoObjectKey) {
            throw new NotFoundException('No photo attached to this ticket');
        }
        const viewUrl = await this.storage.getPresignedGetUrl(ticket.photoObjectKey);
        return { viewUrl, mimeType: ticket.photoMimeType };
    }

    private async applySupportRequestUpdate(
        requestId: string,
        handlerUserId: string,
        dto: UpdateSupportRequestDto,
    ) {
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
                handledById: handlerUserId,
                ...(closedAt !== undefined ? { closedAt } : {}),
            },
            include: this.listInclude(),
        });
    }
}
