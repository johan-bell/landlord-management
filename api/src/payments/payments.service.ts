import { Injectable, NotFoundException } from '@nestjs/common';
import { PaymentStatus, Prisma, ProofVerificationStatus } from '@prisma/client';
import { AuditService } from '../audit/audit.service';
import { OrganizationsService } from '../organizations/organizations.service';
import { PrismaService } from '../prisma/prisma.service';
import { LeasesService } from '../leases/leases.service';
import { CreatePaymentDto } from './dto/create-payment.dto';
import { ListOrgPaymentsQueryDto } from './dto/list-org-payments.query';
import { UpdatePaymentDto } from './dto/update-payment.dto';

@Injectable()
export class PaymentsService {
    constructor(
        private readonly prisma: PrismaService,
        private readonly leasesService: LeasesService,
        private readonly organizationsService: OrganizationsService,
        private readonly audit: AuditService,
    ) {}

    async listForOrganization(orgId: string, query: ListOrgPaymentsQueryDto) {
        await this.organizationsService.findOneOrThrow(orgId);
        const page = query.page ?? 1;
        const limit = query.limit ?? 25;
        const skip = (page - 1) * limit;

        const leaseFilter: Prisma.LeaseWhereInput = {
            unit: { property: { organizationId: orgId } },
        };
        const q = query.search?.trim();
        if (q) {
            leaseFilter.renter = {
                OR: [
                    { fullName: { contains: q, mode: 'insensitive' } },
                    { email: { contains: q, mode: 'insensitive' } },
                ],
            };
        }

        const where: Prisma.PaymentWhereInput = { lease: leaseFilter };
        if (query.status) {
            where.status = query.status;
        }

        const [items, total] = await Promise.all([
            this.prisma.payment.findMany({
                where,
                orderBy: { dueDate: 'desc' },
                skip,
                take: limit,
                include: {
                    lease: {
                        include: {
                            renter: true,
                            unit: { include: { property: true } },
                        },
                    },
                },
            }),
            this.prisma.payment.count({ where }),
        ]);

        return {
            items,
            total,
            page,
            limit,
        };
    }

    async create(orgId: string, leaseId: string, dto: CreatePaymentDto) {
        await this.leasesService.findOne(orgId, leaseId);
        const paidAt = dto.paidAt ? new Date(dto.paidAt) : null;
        const status = dto.status ?? (paidAt ? 'PAID' : 'PENDING');
        return this.prisma.payment.create({
            data: {
                leaseId,
                amount: new Prisma.Decimal(dto.amount),
                currency: dto.currency ?? 'XAF',
                dueDate: new Date(dto.dueDate),
                paidAt,
                status,
                method: dto.method ?? 'OTHER',
                reference: dto.reference,
                notes: dto.notes,
            },
        });
    }

    async findAll(orgId: string, leaseId: string) {
        await this.leasesService.findOne(orgId, leaseId);
        return this.prisma.payment.findMany({
            where: { leaseId },
            orderBy: { dueDate: 'desc' },
        });
    }

    async findOne(orgId: string, leaseId: string, paymentId: string) {
        await this.leasesService.findOne(orgId, leaseId);
        const payment = await this.prisma.payment.findFirst({
            where: { id: paymentId, leaseId },
        });
        if (!payment) {
            throw new NotFoundException(`Payment ${paymentId} not found`);
        }
        return payment;
    }

    async update(
        orgId: string,
        leaseId: string,
        paymentId: string,
        dto: UpdatePaymentDto,
        staffUserId?: string,
    ) {
        await this.findOne(orgId, leaseId, paymentId);
        const data: Prisma.PaymentUpdateInput = {};
        if (dto.amount !== undefined)
            data.amount = new Prisma.Decimal(dto.amount);
        if (dto.currency !== undefined) data.currency = dto.currency;
        if (dto.dueDate !== undefined) data.dueDate = new Date(dto.dueDate);
        if (dto.status !== undefined) data.status = dto.status;
        if (dto.method !== undefined) data.method = dto.method;
        if (dto.paidAt !== undefined)
            data.paidAt = dto.paidAt ? new Date(dto.paidAt) : null;
        if (dto.reference !== undefined) data.reference = dto.reference;
        if (dto.notes !== undefined) data.notes = dto.notes;

        if (dto.status === PaymentStatus.PAID) {
            data.proofVerification = ProofVerificationStatus.APPROVED;
            data.proofVerifiedAt = new Date();
            if (staffUserId) {
                data.proofVerifier = { connect: { id: staffUserId } };
            }
            if (dto.paidAt === undefined && !data.paidAt) {
                data.paidAt = new Date();
            }
        }

        const updated = await this.prisma.payment.update({
            where: { id: paymentId },
            data,
        });
        if (staffUserId) {
            void this.audit.record({
                organizationId: orgId,
                actorUserId: staffUserId,
                action: 'payment.update',
                entityType: 'Payment',
                entityId: paymentId,
                metadata: { patch: dto },
            });
        }
        return updated;
    }

    async remove(
        orgId: string,
        leaseId: string,
        paymentId: string,
        actorUserId?: string,
    ) {
        await this.findOne(orgId, leaseId, paymentId);
        const deleted = await this.prisma.payment.delete({
            where: { id: paymentId },
        });
        if (actorUserId) {
            void this.audit.record({
                organizationId: orgId,
                actorUserId,
                action: 'payment.delete',
                entityType: 'Payment',
                entityId: paymentId,
            });
        }
        return deleted;
    }
}
