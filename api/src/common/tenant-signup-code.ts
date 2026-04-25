import { createHash, randomInt } from 'crypto';

import { Prisma } from '@prisma/client';

const ALPHABET = '23456789ABCDEFGHJKLMNPQRSTUVWXYZ';

type OrgDelegate = {
    findFirst: (args: {
        where: { tenantSignUpCode: string };
        select: { id: true };
    }) => Promise<{ id: string } | null>;
};

/** Human-friendly 4+4 alnum (no 0, O, 1, I, L) for tenant self-signup. */
export function newTenantSignUpCode(): string {
    let a = '';
    let b = '';
    for (let i = 0; i < 4; i++) {
        a += ALPHABET[randomInt(ALPHABET.length)];
    }
    for (let i = 0; i < 4; i++) {
        b += ALPHABET[randomInt(ALPHABET.length)];
    }
    return `${a}-${b}`;
}

/**
 * Normalizes what the user typed: strip spaces, uppercase. Removes hyphens for lookup
 * (codes are stored as `AB12-CD34`).
 */
export function normalizeTenantSignUpKey(raw: string): string {
    return raw.replace(/[\s-]/g, '').toUpperCase();
}

/** Stored form uses a hyphen: `AB12-CD34` — compare normalized forms. */
export function formatTenantSignUpKeyNormalized(normalized: string): string {
    if (normalized.length <= 4) {
        return normalized;
    }
    return `${normalized.slice(0, 4)}-${normalized.slice(4, 8)}`;
}

const CUID_RE = /^c[a-z0-9]{20,30}$/i;

export function looksLikeOrganizationCuid(s: string): boolean {
    return CUID_RE.test(s.trim());
}

/**
 * Heuristic: treat input as a tenant sign-up code (not a cuid) if it is short
 * or clearly not a cuid, so we only match on `tenantSignUpCode` when appropriate.
 */
export function shouldMatchTenantSignUpCode(raw: string): boolean {
    const t = raw.trim();
    if (!t) return false;
    if (looksLikeOrganizationCuid(t)) return false;
    const n = normalizeTenantSignUpKey(t);
    return n.length >= 6 && n.length <= 12;
}

export function isPrismaUniqueConstraint(
    e: unknown,
): e is Prisma.PrismaClientKnownRequestError {
    return e instanceof Prisma.PrismaClientKnownRequestError && e.code === 'P2002';
}

/** Allocate a new unique sign-up code (random; retries on rare collisions). */
export async function allocateUniqueTenantSignUpCode(
    organization: OrgDelegate,
): Promise<string> {
    for (let attempt = 0; attempt < 32; attempt++) {
        const code = newTenantSignUpCode();
        const clash = await organization.findFirst({
            where: { tenantSignUpCode: code },
            select: { id: true },
        });
        if (!clash) {
            return code;
        }
    }
    throw new Error('Could not allocate a unique tenant sign-up code');
}

/**
 * Hash-based fallback so existing DB rows can get a code without a migration loop.
 * Deterministic from organization id; prefer `newTenantSignUpCode` for new orgs.
 */
export function tenantSignUpCodeFromOrgId(id: string): string {
    const h = createHash('sha256').update(`tenantSignUp:${id}`).digest();
    const pick = (i: number) => ALPHABET[h[i]! % ALPHABET.length];
    return `${pick(0)}${pick(1)}${pick(2)}${pick(3)}-${pick(4)}${pick(5)}${pick(6)}${pick(7)}`;
}
