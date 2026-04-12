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

  async register(dto: TenantRegisterDto) {
    const email = dto.email.toLowerCase().trim();
    const token = dto.inviteToken?.trim();
    const rid = dto.renterId?.trim();

    if (!token && !rid) {
      throw new BadRequestException('Provide renterId or inviteToken');
    }
    if (token && rid) {
      throw new BadRequestException('Provide only one of renterId or inviteToken');
    }

    let renter;
    if (token) {
      renter = await this.prisma.renter.findFirst({
        where: {
          inviteToken: token,
          inviteTokenExpiresAt: { gt: new Date() },
        },
      });
      if (!renter) {
        throw new NotFoundException('Invalid or expired invite');
      }
    } else {
      renter = await this.prisma.renter.findUnique({
        where: { id: rid! },
      });
      if (!renter) {
        throw new NotFoundException('Renter not found');
      }
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

    const passwordHash = await bcrypt.hash(dto.password, BCRYPT_ROUNDS);

    const user = await this.prisma.$transaction(async (tx) => {
      const u = await tx.user.create({
        data: {
          email,
          passwordHash,
          name: renter!.fullName,
        },
      });
      await tx.renter.update({
        where: { id: renter!.id },
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
      renterId: renter!.id,
    });

    return {
      access_token,
      renterId: renter!.id,
    };
  }

  async changePassword(userId: string, currentPassword: string, newPassword: string) {
    const user = await this.prisma.user.findUnique({
      where: { id: userId },
      include: { renterProfile: true },
    });
    if (!user?.passwordHash || !user.renterProfile) {
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

  async login(dto: TenantLoginDto) {
    const email = dto.email.toLowerCase().trim();
    const user = await this.prisma.user.findUnique({
      where: { email },
      include: { renterProfile: true },
    });
    if (!user?.passwordHash || !user.renterProfile) {
      throw new UnauthorizedException('Invalid email or password');
    }
    const ok = await bcrypt.compare(dto.password, user.passwordHash);
    if (!ok) {
      throw new UnauthorizedException('Invalid email or password');
    }

    const access_token = this.jwt.sign({
      sub: user.id,
      typ: 'tenant',
      renterId: user.renterProfile.id,
    });

    return {
      access_token,
      renterId: user.renterProfile.id,
    };
  }
}
