import {
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

  async register(dto: TenantRegisterDto) {
    const email = dto.email.toLowerCase().trim();
    const renter = await this.prisma.renter.findUnique({
      where: { id: dto.renterId },
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

    const passwordHash = await bcrypt.hash(dto.password, BCRYPT_ROUNDS);

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
    };
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
