import { Module } from '@nestjs/common';
import { AuthModule } from '../auth/auth.module';
import { EmailModule } from '../email/email.module';
import { OrganizationsModule } from '../organizations/organizations.module';
import { PrismaModule } from '../prisma/prisma.module';
import { StorageModule } from '../storage/storage.module';
import { OrgProofsController } from './org-proofs.controller';
import { ProofsService } from './proofs.service';
import { TenantProofsController } from './tenant-proofs.controller';

@Module({
    imports: [
        PrismaModule,
        AuthModule,
        EmailModule,
        StorageModule,
        OrganizationsModule,
    ],
    controllers: [TenantProofsController, OrgProofsController],
    providers: [ProofsService],
    exports: [ProofsService],
})
export class ProofsModule {}
