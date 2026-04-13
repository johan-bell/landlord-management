import { Prisma } from '@prisma/client';

function daysInMonth(year: number, monthZeroBased: number): number {
  return new Date(year, monthZeroBased + 1, 0).getDate();
}

/** First calendar day (1–28 style) on or after lease start for monthly rent. */
export function firstRentDueOnOrAfter(leaseStart: Date, dueDay: number): Date {
  const s = new Date(leaseStart);
  s.setHours(0, 0, 0, 0);
  let y = s.getFullYear();
  let m = s.getMonth();
  for (let i = 0; i < 36; i++) {
    const dim = daysInMonth(y, m);
    const day = Math.min(dueDay, dim);
    const candidate = new Date(y, m, day, 12, 0, 0, 0);
    if (candidate.getTime() >= s.getTime()) {
      return candidate;
    }
    m += 1;
    if (m > 11) {
      m = 0;
      y += 1;
    }
  }
  throw new Error('Could not compute first rent due date');
}

/** `monthIndex` 0 = first billing month (same month as `firstDue` anchor). */
export function rentDueDateForMonthIndex(
  firstDue: Date,
  dueDay: number,
  monthIndex: number,
): Date {
  let y = firstDue.getFullYear();
  let m = firstDue.getMonth() + monthIndex;
  y += Math.floor(m / 12);
  m = ((m % 12) + 12) % 12;
  const dim = daysInMonth(y, m);
  const day = Math.min(dueDay, dim);
  return new Date(y, m, day, 12, 0, 0, 0);
}

export function computePrepaidRentDueDates(
  leaseStart: Date,
  dueDay: number,
  prepaidMonths: number,
): Date[] {
  if (prepaidMonths <= 0) return [];
  const first = firstRentDueOnOrAfter(leaseStart, dueDay);
  const out: Date[] = [];
  for (let i = 0; i < prepaidMonths; i++) {
    out.push(rentDueDateForMonthIndex(first, dueDay, i));
  }
  return out;
}

type Tx = Prisma.TransactionClient;

export async function createPrepaidRentPayments(
  tx: Tx,
  params: {
    leaseId: string;
    leaseStart: Date;
    dueDay: number;
    rentAmount: Prisma.Decimal;
    currency: string;
    prepaidMonths: number;
  },
): Promise<void> {
  const { leaseId, leaseStart, dueDay, rentAmount, currency, prepaidMonths } = params;
  if (prepaidMonths <= 0) return;

  const dueDates = computePrepaidRentDueDates(leaseStart, dueDay, prepaidMonths);
  const now = new Date();
  for (const dueDate of dueDates) {
    await tx.payment.create({
      data: {
        leaseId,
        amount: rentAmount,
        currency,
        dueDate,
        status: 'PAID',
        paidAt: now,
        method: 'OTHER',
        notes: 'Prepaid at lease creation',
      },
    });
  }
}
