import { randomBytes } from 'node:crypto';
import {
    BadRequestException,
    ConflictException,
    Injectable,
    NotFoundException,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { Prisma } from '@prisma/client';
import * as bcrypt from 'bcrypt';
import {
    PaginationQueryDto,
    parsePagination,
    toPaginated,
} from '../common/dto/pagination-query.dto';
import { PrismaService } from '../prisma/prisma.service';
import { OrganizationsService } from '../organizations/organizations.service';
import { CreateRenterDto } from './dto/create-renter.dto';
import { UpdateRenterDto } from './dto/update-renter.dto';

const RENTER_INVITE_TTL_MS = 14 * 24 * 60 * 60 * 1000;
const BCRYPT_ROUNDS = 10;

@Injectable()
export class RentersService {
    constructor(
        private readonly prisma: PrismaService,
        private readonly organizationsService: OrganizationsService,
        private readonly config: ConfigService,
    ) {}

    async create(orgId: string, dto: CreateRenterDto) {
        await this.organizationsService.findOneOrThrow(orgId);

        const pwd = dto.initialPassword?.trim();
        const emailNormalized = dto.email?.toLowerCase().trim();

        if (pwd) {
            if (!emailNormalized) {
                throw new BadRequestException(
                    'email is required when setting an initial portal password',
                );
            }
            const existingUser = await this.prisma.user.findUnique({
                where: { email: emailNormalized },
            });
            if (existingUser) {
                throw new ConflictException(
                    'A user with this email already exists',
                );
            }
            const passwordHash = await bcrypt.hash(pwd, BCRYPT_ROUNDS);
            return this.prisma.$transaction(async (tx) => {
                const user = await tx.user.create({
                    data: {
                        email: emailNormalized,
                        passwordHash,
                        name: dto.fullName.trim(),
                        phone: dto.phone?.trim() || undefined,
                    },
                });
                return tx.renter.create({
                    data: {
                        organizationId: orgId,
                        fullName: dto.fullName.trim(),
                        phone: dto.phone?.trim() || undefined,
                        email: emailNormalized,
                        idDocument: dto.idDocument?.trim(),
                        notes: dto.notes,
                        userId: user.id,
                    },
                });
            });
        }

        return this.prisma.renter.create({
            data: {
                organizationId: orgId,
                fullName: dto.fullName.trim(),
                phone: dto.phone?.trim() || undefined,
                email: emailNormalized || undefined,
                idDocument: dto.idDocument?.trim(),
                notes: dto.notes,
            },
        });
    }

    async findAll(orgId: string, query?: PaginationQueryDto) {
        await this.organizationsService.findOneOrThrow(orgId);
        const { page, limit, skip } = parsePagination(query);
        const search = query?.search?.trim();
        const where: Prisma.RenterWhereInput = {
            organizationId: orgId,
            ...(search
                ? {
                      OR: [
                          {
                              fullName: {
                                  contains: search,
                                  mode: 'insensitive',
                              },
                          },
                          { email: { contains: search, mode: 'insensitive' } },
                          { phone: { contains: search, mode: 'insensitive' } },
                      ],
                  }
                : {}),
        };
        const [total, items] = await Promise.all([
            this.prisma.renter.count({ where }),
            this.prisma.renter.findMany({
                where,
                orderBy: { fullName: 'asc' },
                skip,
                take: limit,
            }),
        ]);
        return toPaginated(items, total, page, limit);
    }

    async createTenantInviteLink(orgId: string, renterId: string) {
        await this.findOne(orgId, renterId);
        const token = randomBytes(24).toString('base64url');
        const inviteTokenExpiresAt = new Date(
            Date.now() + RENTER_INVITE_TTL_MS,
        );
        await this.prisma.renter.update({
            where: { id: renterId },
            data: { inviteToken: token, inviteTokenExpiresAt },
        });
        const base =
            this.config.get<string>('TENANT_PUBLIC_URL')?.replace(/\/$/, '') ??
            'http://localhost:5174';
        return {
            token,
            expiresAt: inviteTokenExpiresAt,
            registerUrl: `${base}/register?token=${encodeURIComponent(token)}`,
        };
    }

    async findOne(orgId: string, renterId: string) {
        const renter = await this.prisma.renter.findFirst({
            where: { id: renterId, organizationId: orgId },
        });
        if (!renter) {
            throw new NotFoundException(`Renter ${renterId} not found`);
        }
        return renter;
    }

    async update(orgId: string, renterId: string, dto: UpdateRenterDto) {
        await this.findOne(orgId, renterId);
        return this.prisma.renter.update({
            where: { id: renterId },
            data: dto,
        });
    }

    async remove(orgId: string, renterId: string) {
        await this.findOne(orgId, renterId);
        return this.prisma.renter.delete({ where: { id: renterId } });
    }
}
