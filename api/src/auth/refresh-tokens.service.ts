import { Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { hashSecretToken, newRawSecretToken } from '../common/crypto-token';
import { PrismaService } from '../prisma/prisma.service';

export type RefreshTyp = 'staff' | 'platform' | 'tenant';

@Injectable()
export class RefreshTokensService {
    constructor(
        private readonly prisma: PrismaService,
        private readonly config: ConfigService,
    ) {}

    private ttlMs(): number {
        const days = Number(
            this.config.get<string>('JWT_REFRESH_EXPIRES_DAYS', '30'),
        );
        return (
            (Number.isFinite(days) && days > 0 ? days : 30) *
            24 *
            60 *
            60 *
            1000
        );
    }

    async issue(
        userId: string,
        typ: RefreshTyp,
        renterId?: string | null,
    ): Promise<{ raw: string; expiresAt: Date }> {
        const raw = newRawSecretToken();
        const tokenHash = hashSecretToken(raw);
        const expiresAt = new Date(Date.now() + this.ttlMs());
        await this.prisma.refreshToken.create({
            data: {
                userId,
                tokenHash,
                typ,
                renterId: renterId ?? undefined,
                expiresAt,
            },
        });
        return { raw, expiresAt };
    }

    /** Validates token, deletes it (rotation), returns payload for new access token. */
    async consume(raw: string): Promise<{
        userId: string;
        typ: RefreshTyp;
        renterId: string | null;
    } | null> {
        const trimmed = raw?.trim();
        if (!trimmed) {
            return null;
        }
        const tokenHash = hashSecretToken(trimmed);
        const row = await this.prisma.refreshToken.findFirst({
            where: { tokenHash, expiresAt: { gt: new Date() } },
        });
        if (!row) {
            return null;
        }
        await this.prisma.refreshToken.delete({ where: { id: row.id } });
        return {
            userId: row.userId,
            typ: row.typ as RefreshTyp,
            renterId: row.renterId,
        };
    }

    async revokeAllForUser(userId: string): Promise<void> {
        await this.prisma.refreshToken.deleteMany({ where: { userId } });
    }
}
