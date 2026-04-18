import { Module } from '@nestjs/common';
import { AuthModule } from '../auth/auth.module';
import { EmailModule } from '../email/email.module';
import { PrismaModule } from '../prisma/prisma.module';
import { TenantAuthController } from './tenant-auth.controller';
import { TenantAuthService } from './tenant-auth.service';
import { TenantInvitePublicController } from './tenant-invite-public.controller';
import { TenantPortalController } from './tenant-portal.controller';
import { TenantPortalService } from './tenant-portal.service';

@Module({
    imports: [PrismaModule, AuthModule, EmailModule],
    controllers: [
        TenantAuthController,
        TenantPortalController,
        TenantInvitePublicController,
    ],
    providers: [TenantAuthService, TenantPortalService],
})
export class TenantModule {}
