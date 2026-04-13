import { Module } from '@nestjs/common';
import { AuthModule } from '../auth/auth.module';
import { OrganizationsModule } from '../organizations/organizations.module';
import { PrismaModule } from '../prisma/prisma.module';
import { SupportOrgController } from './support-org.controller';
import { SupportPlatformController } from './support-platform.controller';
import { SupportTenantController } from './support-tenant.controller';
import { SupportService } from './support.service';

@Module({
    imports: [PrismaModule, AuthModule, OrganizationsModule],
    controllers: [
        SupportTenantController,
        SupportOrgController,
        SupportPlatformController,
    ],
    providers: [SupportService],
})
export class SupportModule {}
