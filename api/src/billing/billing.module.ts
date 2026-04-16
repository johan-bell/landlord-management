import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { AuthModule } from '../auth/auth.module';
import { OrganizationsModule } from '../organizations/organizations.module';
import { PrismaModule } from '../prisma/prisma.module';
import { BillingController } from './billing.controller';
import { BillingService } from './billing.service';

@Module({
    imports: [ConfigModule, AuthModule, PrismaModule, OrganizationsModule],
    controllers: [BillingController],
    providers: [BillingService],
})
export class BillingModule {}
