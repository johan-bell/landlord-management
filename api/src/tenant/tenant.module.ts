import { Module } from '@nestjs/common';
import { AuthModule } from '../auth/auth.module';
import { PrismaModule } from '../prisma/prisma.module';
import { TenantAuthController } from './tenant-auth.controller';
import { TenantAuthService } from './tenant-auth.service';
import { TenantPortalController } from './tenant-portal.controller';
import { TenantPortalService } from './tenant-portal.service';

@Module({
  imports: [PrismaModule, AuthModule],
  controllers: [TenantAuthController, TenantPortalController],
  providers: [TenantAuthService, TenantPortalService],
})
export class TenantModule {}
