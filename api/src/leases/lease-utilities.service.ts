import {
    BadRequestException,
    Injectable,
    NotFoundException,
} from '@nestjs/common';
import {
    ElectricityBilling,
    PaymentStatus,
    Prisma,
    UtilityKind,
    WaterBilling,
} from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';
import { CreateLeaseUtilityBillDto } from './dto/create-lease-utility-bill.dto';
import { UpdateLeaseUtilityBillDto } from './dto/update-lease-utility-bill.dto';

@Injectable()
export class LeaseUtilitiesService {
    constructor(private readonly prisma: PrismaService) {}

    private async getLeaseWithUnit(orgId: string, leaseId: string) {
        const lease = await this.prisma.lease.findFirst({
            where: {
                id: leaseId,
                unit: { property: { organizationId: orgId } },
            },
            include: { unit: true },
        });
        if (!lease) {
            throw new NotFoundException(`Lease ${leaseId} not found`);
        }
        return lease;
    }

    private assertKindMatchesUnit(
        kind: UtilityKind,
        unit: {
            electricityBilling: ElectricityBilling;
            waterBilling: WaterBilling;
        },
    ) {
        if (kind === UtilityKind.ELECTRICITY) {
            if (unit.electricityBilling !== ElectricityBilling.METERED_KWH) {
                throw new BadRequestException(
                    'Electricity bills can only be recorded when the unit is set to metered electricity (per kWh).',
                );
            }
        } else {
            if (unit.waterBilling !== WaterBilling.METERED_M3) {
                throw new BadRequestException(
                    'Water bills can only be recorded when the unit is set to metered water (per m³).',
                );
            }
        }
    }

    async list(orgId: string, leaseId: string) {
        await this.getLeaseWithUnit(orgId, leaseId);
        return this.prisma.leaseUtilityBill.findMany({
            where: { leaseId },
            orderBy: [{ year: 'desc' }, { month: 'desc' }, { kind: 'asc' }],
        });
    }

    async upsert(
        orgId: string,
        leaseId: string,
        dto: CreateLeaseUtilityBillDto,
    ) {
        const lease = await this.getLeaseWithUnit(orgId, leaseId);
        this.assertKindMatchesUnit(dto.kind, lease.unit);

        const currency = dto.currency?.trim() || lease.currency;
        const dueDate = new Date(dto.dueDate);
        if (Number.isNaN(dueDate.getTime())) {
            throw new BadRequestException('Invalid dueDate');
        }

        return this.prisma.leaseUtilityBill.upsert({
            where: {
                leaseId_kind_year_month: {
                    leaseId,
                    kind: dto.kind,
                    year: dto.year,
                    month: dto.month,
                },
            },
            create: {
                leaseId,
                kind: dto.kind,
                year: dto.year,
                month: dto.month,
                amount: new Prisma.Decimal(dto.amount),
                currency,
                dueDate,
                status: PaymentStatus.PENDING,
            },
            update: {
                amount: new Prisma.Decimal(dto.amount),
                currency,
                dueDate,
            },
        });
    }

    async update(
        orgId: string,
        leaseId: string,
        billId: string,
        dto: UpdateLeaseUtilityBillDto,
    ) {
        await this.getLeaseWithUnit(orgId, leaseId);
        const bill = await this.prisma.leaseUtilityBill.findFirst({
            where: { id: billId, leaseId },
        });
        if (!bill) {
            throw new NotFoundException('Utility bill not found');
        }

        const data: Prisma.LeaseUtilityBillUpdateInput = {};

        if (dto.status !== undefined) {
            data.status = dto.status;
            if (dto.status === PaymentStatus.PAID) {
                data.paidAt =
                    dto.paidAt != null && dto.paidAt !== ''
                        ? new Date(dto.paidAt)
                        : new Date();
            } else {
                data.paidAt = null;
            }
        } else if (dto.paidAt !== undefined) {
            data.paidAt = dto.paidAt ? new Date(dto.paidAt) : null;
        }

        return this.prisma.leaseUtilityBill.update({
            where: { id: billId },
            data,
        });
    }

    async remove(orgId: string, leaseId: string, billId: string) {
        await this.getLeaseWithUnit(orgId, leaseId);
        const bill = await this.prisma.leaseUtilityBill.findFirst({
            where: { id: billId, leaseId },
        });
        if (!bill) {
            throw new NotFoundException('Utility bill not found');
        }
        return this.prisma.leaseUtilityBill.delete({ where: { id: billId } });
    }
}
