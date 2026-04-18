import { createHash, randomBytes } from 'node:crypto';

export function newRawSecretToken(): string {
    return randomBytes(32).toString('base64url');
}

export function hashSecretToken(raw: string): string {
    return createHash('sha256').update(raw, 'utf8').digest('hex');
}
