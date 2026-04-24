import {
    BadRequestException,
    ConflictException,
    Injectable,
    NotFoundException,
    UnauthorizedException,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { JwtService } from '@nestjs/jwt';
import * as bcrypt from 'bcrypt';
import { accessExpiresSeconds } from '../common/jwt-expires';
import { hashSecretToken, newRawSecretToken } from '../common/crypto-token';
import { EmailService } from '../email/email.service';
import { PrismaService } from '../prisma/prisma.service';
import { RefreshTokensService } from '../auth/refresh-tokens.service';
import { TenantLoginDto } from './dto/tenant-login.dto';
import { TenantRegisterDto } from './dto/tenant-register.dto';
import { RefreshTokenDto } from '../auth/dto/refresh-token.dto';
import { ResetPasswordDto } from '../auth/dto/reset-password.dto';

const BCRYPT_ROUNDS = 10;

export type TenantLoginResult = {
    access_token: string;
    refresh_token: string;
    expires_in: number;
    renterId: string | null;
    accountStatus: 'active' | 'pending' | 'rejected';
};

@Injectable()
export class TenantAuthService {
    constructor(
        private readonly prisma: PrismaService,
        private readonly jwt: JwtService,
        private readonly refreshTokens: RefreshTokensService,
        private readonly config: ConfigService,
        private readonly email: EmailService,
    ) {}

    private expiresSeconds(): number {
        return accessExpiresSeconds(this.config);
    }

    private signAccess(userId: string, renterId?: string) {
        const payload =
            renterId !== undefined
                ? { sub: userId, typ: 'tenant' as const, renterId }
                : { sub: userId, typ: 'tenant' as const };
        return this.jwt.sign(payload, {
            expiresIn: this.expiresSeconds(),
        });
    }

    private async issueSession(
        userId: string,
        renterId: string | null,
        accountStatus: TenantLoginResult['accountStatus'],
    ): Promise<TenantLoginResult> {
        await this.refreshTokens.revokeAllForUser(userId);
        const access_token = this.signAccess(
            userId,
            renterId === null ? undefined : renterId,
        );
        const { raw: refresh_token } = await this.refreshTokens.issue(
            userId,
            'tenant',
            renterId,
        );
        return {
            access_token,
            refresh_token,
            expires_in: this.expiresSeconds(),
            renterId,
            accountStatus,
        };
    }

    /** Public: confirm organization exists before self-signup. */
    async previewOrganization(id?: string) {
        const i = id?.trim();
        if (!i) {
            throw new BadRequestException('Provide id query parameter');
        }
        const org = await this.prisma.organization.findFirst({
            where: { id: i, suspendedAt: null },
            select: { id: true, name: true },
        });
        if (!org) {
            throw new NotFoundException('Organization not found');
        }
        return org;
    }

    async register(dto: TenantRegisterDto) {
        const email = dto.email.toLowerCase().trim();
        const orgId = dto.organizationId.trim();
        const fullName = dto.fullName.trim();

        const org = await this.prisma.organization.findFirst({
            where: { id: orgId, suspendedAt: null },
        });
        if (!org) {
            throw new NotFoundException('Organization not found or suspended');
        }

        const existingUser = await this.prisma.user.findUnique({
            where: { email },
        });
        if (existingUser) {
            throw new ConflictException('Email already in use');
        }

        const passwordHash = await bcrypt.hash(dto.password, BCRYPT_ROUNDS);

        const user = await this.prisma.$transaction(async (tx) => {
            const u = await tx.user.create({
                data: {
                    email,
                    passwordHash,
                    name: fullName,
                    phone: dto.phone?.trim() || undefined,
                },
            });
            await tx.tenantSignupRequest.create({
                data: {
                    organizationId: org.id,
                    userId: u.id,
                    status: 'PENDING',
                },
            });
            return u;
        });

        return this.issueSession(user.id, null, 'pending');
    }

    async changePassword(
        userId: string,
        currentPassword: string,
        newPassword: string,
    ) {
        const user = await this.prisma.user.findUnique({
            where: { id: userId },
            include: { renterProfile: true, tenantSignupRequest: true },
        });
        if (!user?.passwordHash) {
            throw new UnauthorizedException();
        }
        const isTenant =
            user.renterProfile ||
            (user.tenantSignupRequest &&
                user.tenantSignupRequest.status === 'PENDING') ||
            (user.tenantSignupRequest &&
                user.tenantSignupRequest.status === 'REJECTED');
        if (!isTenant) {
            throw new UnauthorizedException();
        }
        const ok = await bcrypt.compare(currentPassword, user.passwordHash);
        if (!ok) {
            throw new UnauthorizedException('Current password is incorrect');
        }
        const passwordHash = await bcrypt.hash(newPassword, BCRYPT_ROUNDS);
        await this.prisma.user.update({
            where: { id: userId },
            data: { passwordHash },
        });
        await this.refreshTokens.revokeAllForUser(userId);
        return { ok: true };
    }

    async login(dto: TenantLoginDto): Promise<TenantLoginResult> {
        const email = dto.email.toLowerCase().trim();
        const user = await this.prisma.user.findUnique({
            where: { email },
            include: { renterProfile: true, tenantSignupRequest: true },
        });
        if (!user?.passwordHash) {
            throw new UnauthorizedException('Invalid email or password');
        }

        const ok = await bcrypt.compare(dto.password, user.passwordHash);
        if (!ok) {
            throw new UnauthorizedException('Invalid email or password');
        }

        if (user.renterProfile) {
            return this.issueSession(user.id, user.renterProfile.id, 'active');
        }

        const req = user.tenantSignupRequest;
        if (req?.status === 'PENDING') {
            return this.issueSession(user.id, null, 'pending');
        }

        if (req?.status === 'REJECTED') {
            return this.issueSession(user.id, null, 'rejected');
        }

        throw new UnauthorizedException('Invalid email or password');
    }

    async refresh(dto: RefreshTokenDto): Promise<TenantLoginResult> {
        const consumed = await this.refreshTokens.consume(dto.refresh_token);
        if (!consumed || consumed.typ !== 'tenant') {
            throw new UnauthorizedException();
        }
        const user = await this.prisma.user.findUnique({
            where: { id: consumed.userId },
            include: { renterProfile: true, tenantSignupRequest: true },
        });
        if (!user?.passwordHash) {
            throw new UnauthorizedException();
        }

        if (user.renterProfile) {
            if (
                consumed.renterId &&
                consumed.renterId !== user.renterProfile.id
            ) {
                throw new UnauthorizedException();
            }
            return this.issueSession(user.id, user.renterProfile.id, 'active');
        }

        const req = user.tenantSignupRequest;
        if (req?.status === 'PENDING') {
            if (consumed.renterId) {
                throw new UnauthorizedException();
            }
            return this.issueSession(user.id, null, 'pending');
        }
        if (req?.status === 'REJECTED') {
            if (consumed.renterId) {
                throw new UnauthorizedException();
            }
            return this.issueSession(user.id, null, 'rejected');
        }

        throw new UnauthorizedException();
    }

    private isTenantPortalUser(user: {
        renterProfile: { id: string } | null;
        tenantSignupRequest: { status: string } | null;
    }): boolean {
        return Boolean(
            user.renterProfile ||
            (user.tenantSignupRequest &&
                (user.tenantSignupRequest.status === 'PENDING' ||
                    user.tenantSignupRequest.status === 'REJECTED')),
        );
    }

    async requestPasswordReset(email: string) {
        const normalized = email.toLowerCase().trim();
        const user = await this.prisma.user.findUnique({
            where: { email: normalized },
            include: { renterProfile: true, tenantSignupRequest: true },
        });
        if (!user?.passwordHash) {
            return { ok: true };
        }
        if (!this.isTenantPortalUser(user)) {
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
        const base = this.config
            .get<string>('TENANT_PUBLIC_URL', 'http://localhost:5174')
            .replace(/\/$/, '');
        const link = `${base}/reset-password?token=${encodeURIComponent(raw)}`;
        void this.email.sendPasswordResetTenant({
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
            include: { renterProfile: true, tenantSignupRequest: true },
        });
        if (!user?.passwordHash || !this.isTenantPortalUser(user)) {
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
}
