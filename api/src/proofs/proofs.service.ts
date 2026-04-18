import {
    BadRequestException,
    ForbiddenException,
    Injectable,
    NotFoundException,
} from '@nestjs/common';
import { PaymentStatus, ProofVerificationStatus } from '@prisma/client';
import { AuditService } from '../audit/audit.service';
import { PrismaService } from '../prisma/prisma.service';
import { EmailService } from '../email/email.service';
import { ObjectStorageService } from '../storage/object-storage.service';
import type { RequestUser } from '../auth/types/jwt-payload';
import {
    TenantProofAttachDto,
    TenantProofTarget,
} from './dto/tenant-proof-attach.dto';

@Injectable()
export class ProofsService {
    constructor(
        private readonly prisma: PrismaService,
        private readonly storage: ObjectStorageService,
        private readonly email: EmailService,
        private readonly audit: AuditService,
    ) {}

    private async resolveRenterId(user: RequestUser): Promise<string> {
        let renterId = user.renterId;
        if (!renterId) {
            const r = await this.prisma.renter.findUnique({
                where: { userId: user.userId },
            });
            renterId = r?.id;
        }
        if (!renterId) {
            throw new ForbiddenException('Renter profile required');
        }
        return renterId;
    }

    async createUploadIntent(
        user: RequestUser,
        orgId: string,
        contentType: string,
    ) {
        this.storage.assertEnabled();
        const renterId = await this.resolveRenterId(user);
        const renter = await this.prisma.renter.findFirst({
            where: { id: renterId, organizationId: orgId },
        });
        if (!renter) {
            throw new ForbiddenException('Organization mismatch');
        }
        const key = this.storage.buildReceiptObjectKey(
            orgId,
            contentType.trim(),
        );
        const uploadUrl = await this.storage.getPresignedPutUrl(
            key,
            contentType.trim(),
        );
        return { uploadUrl, objectKey: key, expiresInSeconds: 900 };
    }

    async attachProof(user: RequestUser, dto: TenantProofAttachDto) {
        const orgId = dto.organizationId;
        this.storage.assertEnabled();
        if (!this.storage.keyBelongsToOrg(orgId, dto.objectKey)) {
            throw new BadRequestException('Invalid object key');
        }
        const renterId = await this.resolveRenterId(user);
        if (dto.target === TenantProofTarget.RENT) {
            if (!dto.paymentId) {
                throw new BadRequestException(
                    'paymentId required for rent proof',
                );
            }
            if (dto.utilityBillId) {
                throw new BadRequestException(
                    'utilityBillId must be empty for rent',
                );
            }
            return this.attachRentProof(
                orgId,
                renterId,
                dto.leaseId,
                dto.paymentId,
                dto.objectKey,
                dto.contentType.trim(),
            );
        }
        if (!dto.utilityBillId) {
            throw new BadRequestException(
                'utilityBillId required for utility proof',
            );
        }
        if (dto.paymentId) {
            throw new BadRequestException(
                'paymentId must be empty for utility',
            );
        }
        return this.attachUtilityProof(
            orgId,
            renterId,
            dto.leaseId,
            dto.utilityBillId,
            dto.objectKey,
            dto.contentType.trim(),
        );
    }

    private async attachRentProof(
        orgId: string,
        renterId: string,
        leaseId: string,
        paymentId: string,
        objectKey: string,
        contentType: string,
    ) {
        const lease = await this.prisma.lease.findFirst({
            where: {
                id: leaseId,
                renterId,
                unit: { property: { organizationId: orgId } },
            },
        });
        if (!lease) {
            throw new NotFoundException('Lease not found');
        }
        const payment = await this.prisma.payment.findFirst({
            where: { id: paymentId, leaseId },
        });
        if (!payment) {
            throw new NotFoundException('Payment not found');
        }
        if (payment.status === PaymentStatus.PAID) {
            throw new BadRequestException('Already marked paid');
        }
        if (
            payment.proofVerification ===
            ProofVerificationStatus.PENDING_VERIFICATION
        ) {
            throw new BadRequestException(
                'A receipt is already awaiting verification',
            );
        }
        return this.prisma.payment.update({
            where: { id: paymentId },
            data: {
                proofObjectKey: objectKey,
                proofMimeType: contentType,
                proofVerification: ProofVerificationStatus.PENDING_VERIFICATION,
                proofSubmittedAt: new Date(),
                proofRejectionNote: null,
            },
        });
    }

    private async attachUtilityProof(
        orgId: string,
        renterId: string,
        leaseId: string,
        billId: string,
        objectKey: string,
        contentType: string,
    ) {
        const lease = await this.prisma.lease.findFirst({
            where: {
                id: leaseId,
                renterId,
                unit: { property: { organizationId: orgId } },
            },
        });
        if (!lease) {
            throw new NotFoundException('Lease not found');
        }
        const bill = await this.prisma.leaseUtilityBill.findFirst({
            where: { id: billId, leaseId },
        });
        if (!bill) {
            throw new NotFoundException('Utility bill not found');
        }
        if (bill.status === PaymentStatus.PAID) {
            throw new BadRequestException('Already marked paid');
        }
        if (
            bill.proofVerification ===
            ProofVerificationStatus.PENDING_VERIFICATION
        ) {
            throw new BadRequestException(
                'A receipt is already awaiting verification',
            );
        }
        return this.prisma.leaseUtilityBill.update({
            where: { id: billId },
            data: {
                proofObjectKey: objectKey,
                proofMimeType: contentType,
                proofVerification: ProofVerificationStatus.PENDING_VERIFICATION,
                proofSubmittedAt: new Date(),
                proofRejectionNote: null,
            },
        });
    }

    async listPendingForOrg(orgId: string) {
        const payments = await this.prisma.payment.findMany({
            where: {
                proofVerification: ProofVerificationStatus.PENDING_VERIFICATION,
                lease: {
                    unit: { property: { organizationId: orgId } },
                },
            },
            include: {
                lease: {
                    include: {
                        renter: true,
                        unit: { include: { property: true } },
                    },
                },
            },
            orderBy: { proofSubmittedAt: 'asc' },
        });
        const utilityBills = await this.prisma.leaseUtilityBill.findMany({
            where: {
                proofVerification: ProofVerificationStatus.PENDING_VERIFICATION,
                lease: {
                    unit: { property: { organizationId: orgId } },
                },
            },
            include: {
                lease: {
                    include: {
                        renter: true,
                        unit: { include: { property: true } },
                    },
                },
            },
            orderBy: { proofSubmittedAt: 'asc' },
        });
        return { payments, utilityBills };
    }

    async getViewUrlForOrg(orgId: string, objectKey: string) {
        if (!this.storage.keyBelongsToOrg(orgId, objectKey)) {
            throw new ForbiddenException('Invalid key for organization');
        }
        const belongs = await this.prisma.payment.findFirst({
            where: {
                proofObjectKey: objectKey,
                lease: { unit: { property: { organizationId: orgId } } },
            },
        });
        if (belongs) {
            return {
                viewUrl: await this.storage.getPresignedGetUrl(objectKey),
            };
        }
        const bill = await this.prisma.leaseUtilityBill.findFirst({
            where: {
                proofObjectKey: objectKey,
                lease: { unit: { property: { organizationId: orgId } } },
            },
        });
        if (bill) {
            return {
                viewUrl: await this.storage.getPresignedGetUrl(objectKey),
            };
        }
        throw new NotFoundException('Receipt not found');
    }

    async approveRentPayment(
        orgId: string,
        staffUserId: string,
        paymentId: string,
    ) {
        const payment = await this.prisma.payment.findFirst({
            where: {
                id: paymentId,
                proofVerification: ProofVerificationStatus.PENDING_VERIFICATION,
                lease: { unit: { property: { organizationId: orgId } } },
            },
            include: {
                lease: {
                    include: {
                        renter: {
                            include: {
                                user: { select: { email: true } },
                            },
                        },
                        unit: {
                            include: {
                                property: {
                                    include: {
                                        organization: {
                                            select: { name: true },
                                        },
                                    },
                                },
                            },
                        },
                    },
                },
            },
        });
        if (!payment) {
            throw new NotFoundException('Pending payment proof not found');
        }
        const updated = await this.prisma.payment.update({
            where: { id: paymentId },
            data: {
                status: PaymentStatus.PAID,
                paidAt: new Date(),
                proofVerification: ProofVerificationStatus.APPROVED,
                proofVerifiedAt: new Date(),
                proofVerifier: { connect: { id: staffUserId } },
                proofRejectionNote: null,
            },
        });
        const renter = payment.lease.renter;
        const to =
            renter.user?.email?.trim() || renter.email?.trim() || undefined;
        const orgName = payment.lease.unit.property.organization.name;
        const due = payment.dueDate.toISOString().slice(0, 10);
        void this.email.sendProofApproved({
            to,
            organizationName: orgName,
            topicLine: `rent due ${due}`,
        });
        void this.audit.record({
            organizationId: orgId,
            actorUserId: staffUserId,
            action: 'proof.approve_rent',
            entityType: 'Payment',
            entityId: paymentId,
        });
        return updated;
    }

    async rejectRentPayment(
        orgId: string,
        staffUserId: string,
        paymentId: string,
        note?: string,
    ) {
        const payment = await this.prisma.payment.findFirst({
            where: {
                id: paymentId,
                proofVerification: ProofVerificationStatus.PENDING_VERIFICATION,
                lease: { unit: { property: { organizationId: orgId } } },
            },
            include: {
                lease: {
                    include: {
                        renter: {
                            include: {
                                user: { select: { email: true } },
                            },
                        },
                        unit: {
                            include: {
                                property: {
                                    include: {
                                        organization: {
                                            select: { name: true },
                                        },
                                    },
                                },
                            },
                        },
                    },
                },
            },
        });
        if (!payment) {
            throw new NotFoundException('Pending payment proof not found');
        }
        const updated = await this.prisma.payment.update({
            where: { id: paymentId },
            data: {
                proofVerification: ProofVerificationStatus.REJECTED,
                proofVerifiedAt: new Date(),
                proofVerifier: { connect: { id: staffUserId } },
                proofRejectionNote: note?.trim() || null,
            },
        });
        const renter = payment.lease.renter;
        const to =
            renter.user?.email?.trim() || renter.email?.trim() || undefined;
        const orgName = payment.lease.unit.property.organization.name;
        const due = payment.dueDate.toISOString().slice(0, 10);
        void this.email.sendReceiptRejected({
            to,
            organizationName: orgName,
            topicLine: `rent due ${due}`,
            note,
        });
        void this.audit.record({
            organizationId: orgId,
            actorUserId: staffUserId,
            action: 'proof.reject_rent',
            entityType: 'Payment',
            entityId: paymentId,
        });
        return updated;
    }

    async approveUtilityBill(
        orgId: string,
        staffUserId: string,
        billId: string,
    ) {
        const bill = await this.prisma.leaseUtilityBill.findFirst({
            where: {
                id: billId,
                proofVerification: ProofVerificationStatus.PENDING_VERIFICATION,
                lease: { unit: { property: { organizationId: orgId } } },
            },
            include: {
                lease: {
                    include: {
                        renter: {
                            include: {
                                user: { select: { email: true } },
                            },
                        },
                        unit: {
                            include: {
                                property: {
                                    include: {
                                        organization: {
                                            select: { name: true },
                                        },
                                    },
                                },
                            },
                        },
                    },
                },
            },
        });
        if (!bill) {
            throw new NotFoundException('Pending utility proof not found');
        }
        const updated = await this.prisma.leaseUtilityBill.update({
            where: { id: billId },
            data: {
                status: PaymentStatus.PAID,
                paidAt: new Date(),
                proofVerification: ProofVerificationStatus.APPROVED,
                proofVerifiedAt: new Date(),
                proofVerifier: { connect: { id: staffUserId } },
                proofRejectionNote: null,
            },
        });
        const renter = bill.lease.renter;
        const to =
            renter.user?.email?.trim() || renter.email?.trim() || undefined;
        const orgName = bill.lease.unit.property.organization.name;
        const period = new Date(bill.year, bill.month - 1, 1).toLocaleString(
            'en-US',
            { month: 'long', year: 'numeric' },
        );
        const kind =
            bill.kind === 'ELECTRICITY' ? 'electricity' : 'water utility';
        void this.email.sendProofApproved({
            to,
            organizationName: orgName,
            topicLine: `${kind} — ${period}`,
        });
        void this.audit.record({
            organizationId: orgId,
            actorUserId: staffUserId,
            action: 'proof.approve_utility',
            entityType: 'LeaseUtilityBill',
            entityId: billId,
        });
        return updated;
    }

    async rejectUtilityBill(
        orgId: string,
        staffUserId: string,
        billId: string,
        note?: string,
    ) {
        const bill = await this.prisma.leaseUtilityBill.findFirst({
            where: {
                id: billId,
                proofVerification: ProofVerificationStatus.PENDING_VERIFICATION,
                lease: { unit: { property: { organizationId: orgId } } },
            },
            include: {
                lease: {
                    include: {
                        renter: {
                            include: {
                                user: { select: { email: true } },
                            },
                        },
                        unit: {
                            include: {
                                property: {
                                    include: {
                                        organization: {
                                            select: { name: true },
                                        },
                                    },
                                },
                            },
                        },
                    },
                },
            },
        });
        if (!bill) {
            throw new NotFoundException('Pending utility proof not found');
        }
        const updated = await this.prisma.leaseUtilityBill.update({
            where: { id: billId },
            data: {
                proofVerification: ProofVerificationStatus.REJECTED,
                proofVerifiedAt: new Date(),
                proofVerifier: { connect: { id: staffUserId } },
                proofRejectionNote: note?.trim() || null,
            },
        });
        const renter = bill.lease.renter;
        const to =
            renter.user?.email?.trim() || renter.email?.trim() || undefined;
        const orgName = bill.lease.unit.property.organization.name;
        const period = new Date(bill.year, bill.month - 1, 1).toLocaleString(
            'en-US',
            { month: 'long', year: 'numeric' },
        );
        const kind =
            bill.kind === 'ELECTRICITY' ? 'electricity' : 'water utility';
        void this.email.sendReceiptRejected({
            to,
            organizationName: orgName,
            topicLine: `${kind} — ${period}`,
            note,
        });
        void this.audit.record({
            organizationId: orgId,
            actorUserId: staffUserId,
            action: 'proof.reject_utility',
            entityType: 'LeaseUtilityBill',
            entityId: billId,
        });
        return updated;
    }
}
