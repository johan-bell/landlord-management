import { Module } from '@nestjs/common';
import { JwtModule } from '@nestjs/jwt';
import { ConfigModule, ConfigService } from '@nestjs/config';
import { PassportModule } from '@nestjs/passport';
import { EmailModule } from '../email/email.module';
import { PrismaModule } from '../prisma/prisma.module';
import { AuthController } from './auth.controller';
import { AuthService } from './auth.service';
import { JwtAuthGuard } from './guards/jwt-auth.guard';
import { OrgMembershipGuard } from './guards/org-membership.guard';
import { PlatformAdminGuard } from './guards/platform-admin.guard';
import { TenantOnlyGuard } from './guards/tenant-only.guard';
import { accessExpiresSeconds } from '../common/jwt-expires';
import { resolveJwtSecret } from './jwt-secret';
import { RefreshTokensService } from './refresh-tokens.service';
import { JwtStrategy } from './strategies/jwt.strategy';

@Module({
    imports: [
        ConfigModule,
        PrismaModule,
        EmailModule,
        PassportModule.register({ defaultStrategy: 'jwt' }),
        JwtModule.registerAsync({
            imports: [ConfigModule],
            useFactory: (config: ConfigService) => ({
                secret: resolveJwtSecret(config),
                signOptions: {
                    expiresIn: accessExpiresSeconds(config),
                },
            }),
            inject: [ConfigService],
        }),
    ],
    controllers: [AuthController],
    providers: [
        AuthService,
        RefreshTokensService,
        JwtStrategy,
        OrgMembershipGuard,
        PlatformAdminGuard,
        TenantOnlyGuard,
        JwtAuthGuard,
    ],
    exports: [
        AuthService,
        RefreshTokensService,
        JwtModule,
        PassportModule,
        OrgMembershipGuard,
        PlatformAdminGuard,
        TenantOnlyGuard,
        JwtAuthGuard,
    ],
})
export class AuthModule {}
