import {
    BadRequestException,
    ForbiddenException,
    Injectable,
    NotFoundException,
} from '@nestjs/common';
import { AuditService } from '../audit/audit.service';
import { PrismaService } from '../prisma/prisma.service';
import { ObjectStorageService } from '../storage/object-storage.service';
import { DocumentUploadIntentDto } from './dto/upload-intent.dto';
import { AttachDocumentDto } from './dto/attach-document.dto';

@Injectable()
export class RenterDocumentsService {
    constructor(
        private readonly prisma: PrismaService,
        private readonly storage: ObjectStorageService,
        private readonly audit: AuditService,
    ) {}

    private async assertRenterInOrg(orgId: string, renterId: string) {
        const renter = await this.prisma.renter.findFirst({
            where: { id: renterId, organizationId: orgId, deletedAt: null },
        });
        if (!renter) {
            throw new NotFoundException('Renter not found in this organization');
        }
        return renter;
    }

    async createUploadIntent(
        orgId: string,
        renterId: string,
        dto: DocumentUploadIntentDto,
    ) {
        this.storage.assertEnabled();
        await this.assertRenterInOrg(orgId, renterId);
        const key = this.storage.buildDocumentObjectKey(
            orgId,
            renterId,
            dto.contentType,
        );
        const uploadUrl = await this.storage.getPresignedPutUrl(
            key,
            dto.contentType,
        );
        return { uploadUrl, objectKey: key, expiresInSeconds: 900 };
    }

    async attach(
        orgId: string,
        renterId: string,
        actorUserId: string,
        dto: AttachDocumentDto,
    ) {
        this.storage.assertEnabled();
        if (!this.storage.documentKeyBelongsToOrg(orgId, dto.objectKey)) {
            throw new BadRequestException('Invalid object key for organization');
        }
        await this.assertRenterInOrg(orgId, renterId);

        const doc = await this.prisma.renterDocument.create({
            data: {
                organizationId: orgId,
                renterId,
                uploadedByUserId: actorUserId,
                objectKey: dto.objectKey,
                mimeType: dto.contentType,
                label: dto.label.trim(),
            },
        });

        void this.audit.record({
            organizationId: orgId,
            actorUserId,
            action: 'renter_document.upload',
            entityType: 'RenterDocument',
            entityId: doc.id,
            metadata: { label: doc.label, renterId },
        });

        return doc;
    }

    async list(orgId: string, renterId: string) {
        await this.assertRenterInOrg(orgId, renterId);
        return this.prisma.renterDocument.findMany({
            where: { renterId, organizationId: orgId, deletedAt: null },
            orderBy: { createdAt: 'desc' },
        });
    }

    async getDownloadUrl(orgId: string, renterId: string, docId: string) {
        const doc = await this.prisma.renterDocument.findFirst({
            where: { id: docId, renterId, organizationId: orgId, deletedAt: null },
        });
        if (!doc) {
            throw new NotFoundException('Document not found');
        }
        const viewUrl = await this.storage.getPresignedGetUrl(doc.objectKey);
        return { viewUrl, label: doc.label, mimeType: doc.mimeType };
    }

    async remove(orgId: string, renterId: string, docId: string, actorUserId: string) {
        const doc = await this.prisma.renterDocument.findFirst({
            where: { id: docId, renterId, organizationId: orgId, deletedAt: null },
        });
        if (!doc) {
            throw new NotFoundException('Document not found');
        }
        await this.prisma.renterDocument.update({
            where: { id: docId },
            data: { deletedAt: new Date() },
        });
        void this.audit.record({
            organizationId: orgId,
            actorUserId,
            action: 'renter_document.delete',
            entityType: 'RenterDocument',
            entityId: docId,
            metadata: { label: doc.label, renterId },
        });
        return { id: docId, deleted: true };
    }

    async listForTenant(renterId: string) {
        return this.prisma.renterDocument.findMany({
            where: { renterId, deletedAt: null },
            orderBy: { createdAt: 'desc' },
            select: {
                id: true,
                label: true,
                mimeType: true,
                createdAt: true,
            },
        });
    }

    async getTenantDownloadUrl(renterId: string, docId: string) {
        const doc = await this.prisma.renterDocument.findFirst({
            where: { id: docId, renterId, deletedAt: null },
        });
        if (!doc) {
            throw new NotFoundException('Document not found');
        }
        if (!this.storage.isConfigured()) {
            throw new ForbiddenException('File storage not available');
        }
        const viewUrl = await this.storage.getPresignedGetUrl(doc.objectKey);
        return { viewUrl, label: doc.label, mimeType: doc.mimeType };
    }
}
