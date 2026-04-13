import {
    ConflictException,
    Injectable,
    UnauthorizedException,
} from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import * as bcrypt from 'bcrypt';
import { PrismaService } from '../prisma/prisma.service';
import type { JwtTyp } from './types/jwt-payload';
import { LoginDto } from './dto/login.dto';
import { RegisterDto } from './dto/register.dto';

const BCRYPT_ROUNDS = 10;

@Injectable()
export class AuthService {
    constructor(
        private readonly prisma: PrismaService,
        private readonly jwt: JwtService,
    ) {}

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

        const access_token = this.signUserToken(
            result.user.id,
            this.tokenTyp(result.user),
        );

        return {
            access_token,
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

        const access_token = this.signUserToken(user.id, this.tokenTyp(user));

        return {
            access_token,
            user: {
                id: user.id,
                email: user.email,
                name: user.name,
                isPlatformAdmin: user.isPlatformAdmin,
            },
        };
    }

    private tokenTyp(user: { isPlatformAdmin: boolean }): JwtTyp {
        return user.isPlatformAdmin ? 'platform' : 'staff';
    }

    signUserToken(userId: string, typ: JwtTyp, renterId?: string) {
        return this.jwt.sign(
            renterId ? { sub: userId, typ, renterId } : { sub: userId, typ },
        );
    }
}
