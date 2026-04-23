import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { Cron, CronExpression } from '@nestjs/schedule';
import { PaymentStatus } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';
import { EmailService } from '../email/email.service';

@Injectable()
export class RentReminderService {
    private readonly logger = new Logger(RentReminderService.name);

    constructor(
        private readonly prisma: PrismaService,
        private readonly email: EmailService,
        private readonly config: ConfigService,
    ) {}

    @Cron(CronExpression.EVERY_DAY_AT_8AM)
    async remindUpcomingRent(): Promise<void> {
        const raw = this.config.get<string>('RENT_REMINDER_DAYS_BEFORE', '3');
        const daysBefore = Number(raw);
        const n =
            Number.isFinite(daysBefore) && daysBefore >= 0 ? daysBefore : 3;

        const now = new Date();
        const todayUtc = Date.UTC(
            now.getUTCFullYear(),
            now.getUTCMonth(),
            now.getUTCDate(),
        );
        const targetStart = todayUtc + n * 86400000;
        const targetEnd = targetStart + 86400000;

        const payments = await this.prisma.payment.findMany({
            where: {
                status: PaymentStatus.PENDING,
                dueDate: {
                    gte: new Date(targetStart),
                    lt: new Date(targetEnd),
                },
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

        for (const p of payments) {
            const renter = p.lease.renter;
            const to =
                renter.user?.email?.trim() || renter.email?.trim() || undefined;
            const orgName = p.lease.unit.property.organization.name;
            const dueDateLabel = p.dueDate.toISOString().slice(0, 10);
            const amountLabel = `${p.amount.toString()} ${p.currency}`;
            void this.email.sendRentDueReminder({
                to,
                organizationName: orgName,
                dueDateLabel,
                amountLabel,
            });
        }

        if (payments.length) {
            this.logger.log(
                JSON.stringify({
                    event: 'rent_reminder_batch',
                    count: payments.length,
                    daysBefore: n,
                }),
            );
        }
    }

    @Cron(CronExpression.EVERY_DAY_AT_8AM)
    async markLatePayments(): Promise<void> {
        const now = new Date();
        const startOfToday = new Date(
            Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate()),
        );

        const { count } = await this.prisma.payment.updateMany({
            where: {
                status: PaymentStatus.PENDING,
                dueDate: { lt: startOfToday },
            },
            data: { status: PaymentStatus.LATE },
        });

        const { count: utilCount } = await this.prisma.leaseUtilityBill.updateMany({
            where: {
                status: PaymentStatus.PENDING,
                dueDate: { lt: startOfToday },
            },
            data: { status: PaymentStatus.LATE },
        });

        if (count > 0 || utilCount > 0) {
            this.logger.log(
                JSON.stringify({
                    event: 'payments_marked_late',
                    payments: count,
                    utilityBills: utilCount,
                }),
            );
        }
    }

    @Cron(CronExpression.EVERY_DAY_AT_8AM)
    async alertExpiringLeases(): Promise<void> {
        const ALERT_DAYS = [30, 60, 90];
        const now = new Date();

        for (const days of ALERT_DAYS) {
            const windowStart = new Date(
                Date.UTC(
                    now.getUTCFullYear(),
                    now.getUTCMonth(),
                    now.getUTCDate() + days,
                ),
            );
            const windowEnd = new Date(windowStart.getTime() + 86_400_000);

            const leases = await this.prisma.lease.findMany({
                where: {
                    endDate: { gte: windowStart, lt: windowEnd },
                },
                include: {
                    renter: true,
                    unit: {
                        include: {
                            property: {
                                include: {
                                    organization: {
                                        select: { id: true, name: true },
                                    },
                                },
                            },
                        },
                    },
                },
            });

            for (const lease of leases) {
                const orgId = lease.unit.property.organization.id;
                const orgName = lease.unit.property.organization.name;

                const owners = await this.prisma.organizationMember.findMany({
                    where: { organizationId: orgId, role: 'OWNER' },
                    include: { user: { select: { email: true } } },
                });

                for (const member of owners) {
                    void this.email.sendLeaseExpiryAlert({
                        to: member.user.email,
                        organizationName: orgName,
                        renterName: lease.renter.fullName,
                        unitLabel: lease.unit.label,
                        expiryDate: lease.endDate!.toISOString().slice(0, 10),
                        daysUntilExpiry: days,
                    });
                }
            }

            if (leases.length) {
                this.logger.log(
                    JSON.stringify({
                        event: 'lease_expiry_alerts_sent',
                        daysUntilExpiry: days,
                        count: leases.length,
                    }),
                );
            }
        }
    }
}
