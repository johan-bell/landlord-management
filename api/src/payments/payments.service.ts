import { Injectable, NotFoundException } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';
import { LeasesService } from '../leases/leases.service';
import { CreatePaymentDto } from './dto/create-payment.dto';
import { UpdatePaymentDto } from './dto/update-payment.dto';

@Injectable()
export class PaymentsService {
    constructor(
        private readonly prisma: PrismaService,
        private readonly leasesService: LeasesService,
    ) {}

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

        return this.prisma.payment.update({
            where: { id: paymentId },
            data,
        });
    }

    async remove(orgId: string, leaseId: string, paymentId: string) {
        await this.findOne(orgId, leaseId, paymentId);
        return this.prisma.payment.delete({ where: { id: paymentId } });
    }
}
