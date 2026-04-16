import {
    BadRequestException,
    Injectable,
    NotFoundException,
} from '@nestjs/common';
import {
    ElectricityBilling,
    PaymentStatus,
    Prisma,
    ProofVerificationStatus,
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

    private computeMeteredAmount(
        lease: {
            unit: {
                waterPricePerM3: Prisma.Decimal | null;
                electricityPricePerKwh: Prisma.Decimal | null;
            };
        },
        kind: UtilityKind,
        previousIndex: Prisma.Decimal,
        currentIndex: Prisma.Decimal,
    ): { consumption: Prisma.Decimal; amount: Prisma.Decimal } {
        if (currentIndex.lessThan(previousIndex)) {
            throw new BadRequestException(
                'Current meter index must be greater than or equal to the previous reading.',
            );
        }
        const consumption = currentIndex.minus(previousIndex);
        const price =
            kind === UtilityKind.WATER
                ? lease.unit.waterPricePerM3
                : lease.unit.electricityPricePerKwh;
        if (!price) {
            throw new BadRequestException(
                'Set the unit price (per m³ or per kWh) before billing from meter readings.',
            );
        }
        const amount = consumption.mul(price);
        return { consumption, amount };
    }

    private async resolveUtilityAmount(
        leaseId: string,
        lease: {
            unit: {
                waterPricePerM3: Prisma.Decimal | null;
                electricityPricePerKwh: Prisma.Decimal | null;
            };
        },
        dto: CreateLeaseUtilityBillDto,
    ): Promise<{
        amount: Prisma.Decimal;
        previousIndex: Prisma.Decimal | null;
        currentIndex: Prisma.Decimal | null;
        consumption: Prisma.Decimal | null;
    }> {
        const useMeter = dto.currentMeterIndex != null;
        const useAmount = dto.amount != null;
        if (useMeter === useAmount) {
            throw new BadRequestException(
                'Provide either amount (manual) or currentMeterIndex (metered), not both and not neither.',
            );
        }
        if (useAmount) {
            return {
                amount: new Prisma.Decimal(dto.amount!),
                previousIndex: null,
                currentIndex: null,
                consumption: null,
            };
        }
        const last = await this.prisma.leaseUtilityBill.findFirst({
            where: { leaseId, kind: dto.kind },
            orderBy: [{ year: 'desc' }, { month: 'desc' }],
        });
        let previous: Prisma.Decimal | null = null;
        if (dto.previousMeterIndex != null) {
            previous = new Prisma.Decimal(dto.previousMeterIndex);
        } else if (last?.currentIndex != null) {
            previous = last.currentIndex;
        }
        if (previous === null) {
            throw new BadRequestException(
                'Set previousMeterIndex for the first bill, or create an earlier bill with a current meter reading.',
            );
        }
        const current = new Prisma.Decimal(dto.currentMeterIndex!);
        const { consumption, amount } = this.computeMeteredAmount(
            lease,
            dto.kind,
            previous,
            current,
        );
        return {
            amount,
            previousIndex: previous,
            currentIndex: current,
            consumption,
        };
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

        const resolved = await this.resolveUtilityAmount(leaseId, lease, dto);

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
                amount: resolved.amount,
                currency,
                dueDate,
                status: PaymentStatus.PENDING,
                previousIndex: resolved.previousIndex ?? undefined,
                currentIndex: resolved.currentIndex ?? undefined,
                consumption: resolved.consumption ?? undefined,
            },
            update: {
                amount: resolved.amount,
                currency,
                dueDate,
                previousIndex: resolved.previousIndex ?? null,
                currentIndex: resolved.currentIndex ?? null,
                consumption: resolved.consumption ?? null,
            },
        });
    }

    async update(
        orgId: string,
        leaseId: string,
        billId: string,
        dto: UpdateLeaseUtilityBillDto,
        staffUserId?: string,
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
                data.proofVerification = ProofVerificationStatus.APPROVED;
                data.proofVerifiedAt = new Date();
                if (staffUserId) {
                    data.proofVerifier = { connect: { id: staffUserId } };
                }
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
