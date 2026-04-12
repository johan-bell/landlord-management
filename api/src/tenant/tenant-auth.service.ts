import {
  BadRequestException,
  ConflictException,
  Injectable,
  NotFoundException,
  UnauthorizedException,
} from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import * as bcrypt from 'bcrypt';
import { PrismaService } from '../prisma/prisma.service';
import { TenantLoginDto } from './dto/tenant-login.dto';
import { TenantRegisterDto } from './dto/tenant-register.dto';

const BCRYPT_ROUNDS = 10;

export type TenantLoginResult = {
  access_token: string;
  renterId: string | null;
  accountStatus: 'active' | 'pending' | 'rejected';
};

@Injectable()
export class TenantAuthService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly jwt: JwtService,
  ) {}

  async previewInvite(token: string) {
    const renter = await this.prisma.renter.findFirst({
      where: {
        inviteToken: token,
        inviteTokenExpiresAt: { gt: new Date() },
      },
    });
    if (!renter) {
      throw new NotFoundException('Invalid or expired invite');
    }
    const email = renter.email;
    const emailHint = email
      ? email.replace(/(^.).*(@.+$)/, (_m, a, domain) => `${a}***${domain}`)
      : null;
    return {
      renterId: renter.id,
      fullName: renter.fullName,
      emailHint,
    };
  }

  /** Public: confirm organization exists for self-signup (id or slug). */
  async previewOrganization(id?: string, slug?: string) {
    const i = id?.trim();
    const s = slug?.trim();
    if (!i && !s) {
      throw new BadRequestException('Provide id or slug query parameter');
    }
    const org = await this.prisma.organization.findFirst({
      where: {
        ...(i ? { id: i } : { slug: s }),
        suspendedAt: null,
      },
      select: { id: true, name: true, slug: true },
    });
    if (!org) {
      throw new NotFoundException('Organization not found');
    }
    return org;
  }

  async register(dto: TenantRegisterDto) {
    const email = dto.email.toLowerCase().trim();
    const token = dto.inviteToken?.trim();
    const rid = dto.renterId?.trim();
    const orgId = dto.organizationId?.trim();
    const orgSlug = dto.organizationSlug?.trim();

    const orgRequest = Boolean(orgId || orgSlug);
    const claimInvite = Boolean(token);
    const claimRenterId = Boolean(rid);

    const modes = [orgRequest, claimInvite, claimRenterId].filter(Boolean).length;
    if (modes !== 1) {
      throw new BadRequestException(
        'Use exactly one of: organization id/slug (self-signup), inviteToken, or renterId',
      );
    }

    if (orgRequest) {
      return this.registerByOrganization(email, dto.password, orgId, orgSlug, dto);
    }
    if (claimInvite) {
      return this.registerByInvite(email, dto.password, token!);
    }
    return this.registerByRenterId(email, dto.password, rid!);
  }

  private async registerByOrganization(
    email: string,
    password: string,
    organizationId: string | undefined,
    organizationSlug: string | undefined,
    dto: TenantRegisterDto,
  ) {
    const fullName = dto.fullName?.trim();
    if (!fullName) {
      throw new BadRequestException('fullName is required for organization signup');
    }

    const org = await this.prisma.organization.findFirst({
      where: {
        ...(organizationId ? { id: organizationId } : { slug: organizationSlug }),
        suspendedAt: null,
      },
    });
    if (!org) {
      throw new NotFoundException('Organization not found or suspended');
    }

    const existingUser = await this.prisma.user.findUnique({ where: { email } });
    if (existingUser) {
      throw new ConflictException('Email already in use');
    }

    const passwordHash = await bcrypt.hash(password, BCRYPT_ROUNDS);

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

    const access_token = this.jwt.sign({
      sub: user.id,
      typ: 'tenant',
    });

    return {
      access_token,
      renterId: null as string | null,
      accountStatus: 'pending' as const,
    };
  }

  private async registerByInvite(email: string, password: string, token: string) {
    const renter = await this.prisma.renter.findFirst({
      where: {
        inviteToken: token,
        inviteTokenExpiresAt: { gt: new Date() },
      },
    });
    if (!renter) {
      throw new NotFoundException('Invalid or expired invite');
    }
    if (!renter.email || renter.email.toLowerCase() !== email) {
      throw new UnauthorizedException('Email does not match this renter profile');
    }
    if (renter.userId) {
      throw new ConflictException('This renter profile already has an account');
    }

    const existingUser = await this.prisma.user.findUnique({ where: { email } });
    if (existingUser) {
      throw new ConflictException('Email already in use');
    }

    const passwordHash = await bcrypt.hash(password, BCRYPT_ROUNDS);

    const user = await this.prisma.$transaction(async (tx) => {
      const u = await tx.user.create({
        data: {
          email,
          passwordHash,
          name: renter.fullName,
        },
      });
      await tx.renter.update({
        where: { id: renter.id },
        data: {
          userId: u.id,
          inviteToken: null,
          inviteTokenExpiresAt: null,
        },
      });
      return u;
    });

    const access_token = this.jwt.sign({
      sub: user.id,
      typ: 'tenant',
      renterId: renter.id,
    });

    return {
      access_token,
      renterId: renter.id,
      accountStatus: 'active' as const,
    };
  }

  private async registerByRenterId(email: string, password: string, rid: string) {
    const renter = await this.prisma.renter.findUnique({
      where: { id: rid },
    });
    if (!renter) {
      throw new NotFoundException('Renter not found');
    }
    if (!renter.email || renter.email.toLowerCase() !== email) {
      throw new UnauthorizedException('Email does not match this renter profile');
    }
    if (renter.userId) {
      throw new ConflictException('This renter profile already has an account');
    }

    const existingUser = await this.prisma.user.findUnique({ where: { email } });
    if (existingUser) {
      throw new ConflictException('Email already in use');
    }

    const passwordHash = await bcrypt.hash(password, BCRYPT_ROUNDS);

    const user = await this.prisma.$transaction(async (tx) => {
      const u = await tx.user.create({
        data: {
          email,
          passwordHash,
          name: renter.fullName,
        },
      });
      await tx.renter.update({
        where: { id: renter.id },
        data: { userId: u.id },
      });
      return u;
    });

    const access_token = this.jwt.sign({
      sub: user.id,
      typ: 'tenant',
      renterId: renter.id,
    });

    return {
      access_token,
      renterId: renter.id,
      accountStatus: 'active' as const,
    };
  }

  async changePassword(userId: string, currentPassword: string, newPassword: string) {
    const user = await this.prisma.user.findUnique({
      where: { id: userId },
      include: { renterProfile: true, tenantSignupRequest: true },
    });
    if (!user?.passwordHash) {
      throw new UnauthorizedException();
    }
    const isTenant =
      user.renterProfile ||
      (user.tenantSignupRequest && user.tenantSignupRequest.status === 'PENDING') ||
      (user.tenantSignupRequest && user.tenantSignupRequest.status === 'REJECTED');
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
      const access_token = this.jwt.sign({
        sub: user.id,
        typ: 'tenant',
        renterId: user.renterProfile.id,
      });
      return {
        access_token,
        renterId: user.renterProfile.id,
        accountStatus: 'active',
      };
    }

    const req = user.tenantSignupRequest;
    if (req?.status === 'PENDING') {
      const access_token = this.jwt.sign({
        sub: user.id,
        typ: 'tenant',
      });
      return {
        access_token,
        renterId: null,
        accountStatus: 'pending',
      };
    }

    if (req?.status === 'REJECTED') {
      const access_token = this.jwt.sign({
        sub: user.id,
        typ: 'tenant',
      });
      return {
        access_token,
        renterId: null,
        accountStatus: 'rejected',
      };
    }

    throw new UnauthorizedException('Invalid email or password');
  }
}
