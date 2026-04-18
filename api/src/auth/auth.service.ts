import {
    BadRequestException,
    ConflictException,
    Injectable,
    UnauthorizedException,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { JwtService } from '@nestjs/jwt';
import * as bcrypt from 'bcrypt';
import { accessExpiresSeconds } from '../common/jwt-expires';
import { hashSecretToken, newRawSecretToken } from '../common/crypto-token';
import { EmailService } from '../email/email.service';
import { PrismaService } from '../prisma/prisma.service';
import type { JwtTyp } from './types/jwt-payload';
import { LoginDto } from './dto/login.dto';
import { RefreshTokenDto } from './dto/refresh-token.dto';
import { RegisterDto } from './dto/register.dto';
import { ResetPasswordDto } from './dto/reset-password.dto';
import { RefreshTokensService } from './refresh-tokens.service';

const BCRYPT_ROUNDS = 10;

@Injectable()
export class AuthService {
    constructor(
        private readonly prisma: PrismaService,
        private readonly jwt: JwtService,
        private readonly refreshTokens: RefreshTokensService,
        private readonly config: ConfigService,
        private readonly email: EmailService,
    ) {}

    accessExpiresSeconds(): number {
        return accessExpiresSeconds(this.config);
    }

    async register(dto: RegisterDto) {
        const email = dto.email.toLowerCase().trim();
        const existing = await this.prisma.user.findUnique({
            where: { email },
        });
        if (existing) {
            throw new ConflictException('Email already registered');
        }

        const passwordHash = await bcrypt.hash(dto.password, BCRYPT_ROUNDS);

        const result = await this.prisma.$transaction(async (tx) => {
            const user = await tx.user.create({
                data: {
                    email,
                    passwordHash,
                    name: dto.name?.trim(),
                },
            });
            const org = await tx.organization.create({
                data: {
                    name: dto.organizationName.trim(),
                    slug: dto.slug?.trim() || undefined,
                },
            });
            await tx.organizationMember.create({
                data: {
                    userId: user.id,
                    organizationId: org.id,
                    role: 'OWNER',
                },
            });
            return { user, organization: org };
        });

        await this.refreshTokens.revokeAllForUser(result.user.id);
        const typ = this.tokenTyp(result.user);
        const access_token = this.signUserToken(result.user.id, typ);
        const { raw: refresh_token } = await this.refreshTokens.issue(
            result.user.id,
            typ,
        );

        return {
            access_token,
            refresh_token,
            expires_in: this.accessExpiresSeconds(),
            user: {
                id: result.user.id,
                email: result.user.email,
                name: result.user.name,
                isPlatformAdmin: result.user.isPlatformAdmin,
            },
            organization: result.organization,
        };
    }

    async login(dto: LoginDto) {
        const email = dto.email.toLowerCase().trim();
        const user = await this.prisma.user.findUnique({ where: { email } });
        if (!user?.passwordHash) {
            throw new UnauthorizedException('Invalid email or password');
        }
        const ok = await bcrypt.compare(dto.password, user.passwordHash);
        if (!ok) {
            throw new UnauthorizedException('Invalid email or password');
        }

        await this.refreshTokens.revokeAllForUser(user.id);
        const typ = this.tokenTyp(user);
        const access_token = this.signUserToken(user.id, typ);
        const { raw: refresh_token } = await this.refreshTokens.issue(
            user.id,
            typ,
        );

        return {
            access_token,
            refresh_token,
            expires_in: this.accessExpiresSeconds(),
            user: {
                id: user.id,
                email: user.email,
                name: user.name,
                isPlatformAdmin: user.isPlatformAdmin,
            },
        };
    }

    async refresh(dto: RefreshTokenDto) {
        const consumed = await this.refreshTokens.consume(dto.refresh_token);
        if (!consumed || consumed.typ === 'tenant') {
            throw new UnauthorizedException();
        }
        const user = await this.prisma.user.findUnique({
            where: { id: consumed.userId },
        });
        if (!user?.passwordHash) {
            throw new UnauthorizedException();
        }
        const typ = this.tokenTyp(user);
        if (typ === 'platform' && consumed.typ !== 'platform') {
            throw new UnauthorizedException();
        }
        if (typ === 'staff' && consumed.typ !== 'staff') {
            throw new UnauthorizedException();
        }

        const access_token = this.signUserToken(user.id, typ);
        const { raw: refresh_token } = await this.refreshTokens.issue(
            user.id,
            typ,
        );

        return {
            access_token,
            refresh_token,
            expires_in: this.accessExpiresSeconds(),
            user: {
                id: user.id,
                email: user.email,
                name: user.name,
                isPlatformAdmin: user.isPlatformAdmin,
            },
        };
    }

    async requestPasswordReset(email: string) {
        const normalized = email.toLowerCase().trim();
        const user = await this.prisma.user.findUnique({
            where: { email: normalized },
            include: { memberships: { take: 1 } },
        });
        if (!user?.passwordHash) {
            return { ok: true };
        }
        const staffOk = user.isPlatformAdmin || user.memberships.length > 0;
        if (!staffOk) {
            return { ok: true };
        }

        await this.prisma.passwordResetToken.deleteMany({
            where: { userId: user.id },
        });
        const raw = newRawSecretToken();
        const expiresAt = new Date(Date.now() + 60 * 60 * 1000);
        await this.prisma.passwordResetToken.create({
            data: {
                userId: user.id,
                tokenHash: hashSecretToken(raw),
                expiresAt,
            },
        });
        const platformOnly =
            user.isPlatformAdmin && user.memberships.length === 0;
        const baseUrl = platformOnly
            ? this.config.get<string>(
                  'PLATFORM_PUBLIC_URL',
                  'http://localhost:5175',
              )
            : this.config.get<string>(
                  'ADMIN_PUBLIC_URL',
                  'http://localhost:5173',
              );
        const base = baseUrl.replace(/\/$/, '');
        const link = `${base}/reset-password?token=${encodeURIComponent(raw)}`;
        void this.email.sendPasswordResetStaff({
            to: user.email,
            resetUrl: link,
        });
        return { ok: true };
    }

    async resetPassword(dto: ResetPasswordDto) {
        const hash = hashSecretToken(dto.token.trim());
        const row = await this.prisma.passwordResetToken.findFirst({
            where: { tokenHash: hash, expiresAt: { gt: new Date() } },
        });
        if (!row) {
            throw new BadRequestException('Invalid or expired token');
        }
        const user = await this.prisma.user.findUnique({
            where: { id: row.userId },
            include: { memberships: { take: 1 } },
        });
        if (!user?.passwordHash) {
            throw new BadRequestException('Invalid token');
        }
        if (!user.isPlatformAdmin && user.memberships.length === 0) {
            throw new BadRequestException('Invalid token');
        }

        const passwordHash = await bcrypt.hash(dto.password, BCRYPT_ROUNDS);
        await this.prisma.$transaction([
            this.prisma.user.update({
                where: { id: user.id },
                data: { passwordHash },
            }),
            this.prisma.passwordResetToken.deleteMany({
                where: { userId: user.id },
            }),
            this.prisma.refreshToken.deleteMany({ where: { userId: user.id } }),
        ]);
        return { ok: true };
    }

    private tokenTyp(user: { isPlatformAdmin: boolean }): JwtTyp {
        return user.isPlatformAdmin ? 'platform' : 'staff';
    }

    signUserToken(userId: string, typ: JwtTyp, renterId?: string) {
        const payload = renterId
            ? { sub: userId, typ, renterId }
            : { sub: userId, typ };
        return this.jwt.sign(payload, {
            expiresIn: this.accessExpiresSeconds(),
        });
    }
}
