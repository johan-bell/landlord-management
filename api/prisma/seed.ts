import { existsSync, readFileSync } from 'node:fs';
import { join } from 'node:path';
import { config as loadEnv } from 'dotenv';
import * as bcrypt from 'bcrypt';
import { PrismaPg } from '@prisma/adapter-pg';
import { Prisma, PrismaClient } from '@prisma/client';
import { Pool } from 'pg';

function seedDataPath(name: string): string {
  return join(process.cwd(), 'prisma', 'seed-data', name);
}

function loadDatabaseUrl(): string {
  const candidates = [join(process.cwd(), '.env'), join(process.cwd(), 'api', '.env')];
  for (const path of candidates) {
    if (existsSync(path)) {
      loadEnv({ path });
      break;
    }
  }
  const url = process.env.DATABASE_URL?.trim();
  if (!url) {
    throw new Error(
      'DATABASE_URL is not set. Configure api/.env then run: npx prisma db seed',
    );
  }
  return url;
}

function readJson<T>(name: string): T {
  return JSON.parse(readFileSync(seedDataPath(name), 'utf8')) as T;
}

function prismaClient(url: string) {
  const pool = new Pool({ connectionString: url });
  const adapter = new PrismaPg(pool);
  const prisma = new PrismaClient({ adapter });
  return { prisma, pool };
}

async function main() {
  const url = loadDatabaseUrl();
  const { prisma, pool } = prismaClient(url);

  const orgs = readJson<Array<{ id: string; name: string; slug: string | null }>>(
    'organizations.json',
  );
  for (const row of orgs) {
    await prisma.organization.upsert({
      where: { id: row.id },
      create: row,
      update: { name: row.name, slug: row.slug },
    });
  }

  const users = readJson<
    Array<{ id: string; email: string; name: string | null; phone: string | null }>
  >('users.json');
  for (const row of users) {
    await prisma.user.upsert({
      where: { id: row.id },
      create: row,
      update: { email: row.email, name: row.name, phone: row.phone },
    });
  }

  const landlordDemoHash = await bcrypt.hash('DemoLandlord123!', 10);
  for (const id of ['seed_user_owner', 'seed_user_manager']) {
    await prisma.user.update({
      where: { id },
      data: { passwordHash: landlordDemoHash },
    });
  }

  const platformHash = await bcrypt.hash('PlatformDev123!', 10);
  await prisma.user.upsert({
    where: { email: 'platform@landlord.local' },
    create: {
      email: 'platform@landlord.local',
      passwordHash: platformHash,
      name: 'Platform Admin',
      isPlatformAdmin: true,
    },
    update: {
      passwordHash: platformHash,
      isPlatformAdmin: true,
    },
  });

  const members = readJson<
    Array<{
      id: string;
      userId: string;
      organizationId: string;
      role: 'OWNER' | 'MANAGER' | 'STAFF';
    }>
  >('organization_members.json');
  for (const row of members) {
    await prisma.organizationMember.upsert({
      where: { id: row.id },
      create: row,
      update: { role: row.role },
    });
  }

  const properties = readJson<
    Array<{ id: string; organizationId: string; name: string; address: string | null }>
  >('properties.json');
  for (const row of properties) {
    await prisma.property.upsert({
      where: { id: row.id },
      create: row,
      update: { name: row.name, address: row.address },
    });
  }

  const units = readJson<
    Array<{
      id: string;
      propertyId: string;
      label: string;
      rentAmount: number;
      currency: string;
      status: 'VACANT' | 'OCCUPIED';
    }>
  >('units.json');
  for (const row of units) {
    await prisma.unit.upsert({
      where: { id: row.id },
      create: {
        ...row,
        rentAmount: new Prisma.Decimal(row.rentAmount),
      },
      update: {
        label: row.label,
        rentAmount: new Prisma.Decimal(row.rentAmount),
        currency: row.currency,
        status: row.status,
      },
    });
  }

  const renters = readJson<
    Array<{
      id: string;
      organizationId: string;
      fullName: string;
      phone: string | null;
      email: string | null;
      idDocument: string | null;
      notes: string | null;
    }>
  >('renters.json');
  for (const row of renters) {
    await prisma.renter.upsert({
      where: { id: row.id },
      create: row,
      update: {
        fullName: row.fullName,
        phone: row.phone,
        email: row.email,
        idDocument: row.idDocument,
        notes: row.notes,
      },
    });
  }

  const leases = readJson<
    Array<{
      id: string;
      unitId: string;
      renterId: string;
      startDate: string;
      endDate: string | null;
      rentAmount: number;
      currency: string;
      dueDay: number;
    }>
  >('leases.json');
  for (const row of leases) {
    await prisma.lease.upsert({
      where: { id: row.id },
      create: {
        id: row.id,
        unitId: row.unitId,
        renterId: row.renterId,
        startDate: new Date(row.startDate),
        endDate: row.endDate ? new Date(row.endDate) : null,
        rentAmount: new Prisma.Decimal(row.rentAmount),
        currency: row.currency,
        dueDay: row.dueDay,
      },
      update: {
        startDate: new Date(row.startDate),
        endDate: row.endDate ? new Date(row.endDate) : null,
        rentAmount: new Prisma.Decimal(row.rentAmount),
        currency: row.currency,
        dueDay: row.dueDay,
      },
    });
  }

  const payments = readJson<
    Array<{
      id: string;
      leaseId: string;
      amount: number;
      currency: string;
      dueDate: string;
      paidAt: string | null;
      status: 'PENDING' | 'PAID' | 'LATE' | 'CANCELLED';
      method: 'CASH' | 'MOBILE_MONEY' | 'BANK' | 'OTHER';
      reference: string | null;
      notes: string | null;
    }>
  >('payments.json');
  for (const row of payments) {
    await prisma.payment.upsert({
      where: { id: row.id },
      create: {
        id: row.id,
        leaseId: row.leaseId,
        amount: new Prisma.Decimal(row.amount),
        currency: row.currency,
        dueDate: new Date(row.dueDate),
        paidAt: row.paidAt ? new Date(row.paidAt) : null,
        status: row.status,
        method: row.method,
        reference: row.reference,
        notes: row.notes,
      },
      update: {
        amount: new Prisma.Decimal(row.amount),
        currency: row.currency,
        dueDate: new Date(row.dueDate),
        paidAt: row.paidAt ? new Date(row.paidAt) : null,
        status: row.status,
        method: row.method,
        reference: row.reference,
        notes: row.notes,
      },
    });
  }

  const tenantDemoHash = await bcrypt.hash('DemoTenant123!', 10);
  const tenantUser = await prisma.user.upsert({
    where: { email: 'jean.mbarga@example.com' },
    create: {
      email: 'jean.mbarga@example.com',
      passwordHash: tenantDemoHash,
      name: 'Jean Mbarga',
    },
    update: { passwordHash: tenantDemoHash },
  });
  await prisma.renter.update({
    where: { id: 'seed_renter_jean' },
    data: { userId: tenantUser.id },
  });

  await prisma.$disconnect();
  await pool.end();
  console.log(
    'Seed completed. Landlord: owner@demo.landlord.local / DemoLandlord123! · Platform: platform@landlord.local / PlatformDev123! · Tenant: jean.mbarga@example.com / DemoTenant123!',
  );
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
