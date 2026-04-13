import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { AppController } from './app.controller';
import { AppService } from './app.service';
import { AuthModule } from './auth/auth.module';
import { BillingModule } from './billing/billing.module';
import { LeasesModule } from './leases/leases.module';
import { OrganizationsModule } from './organizations/organizations.module';
import { PaymentsModule } from './payments/payments.module';
import { PlatformModule } from './platform/platform.module';
import { PrismaModule } from './prisma/prisma.module';
import { PropertiesModule } from './properties/properties.module';
import { RentersModule } from './renters/renters.module';
import { SupportModule } from './support/support.module';
import { TenantModule } from './tenant/tenant.module';
import { UnitsModule } from './units/units.module';

@Module({
    imports: [
        ConfigModule.forRoot({
            isGlobal: true,
            envFilePath: ['.env', '.env.local'],
        }),
        PrismaModule,
        AuthModule,
        OrganizationsModule,
        PropertiesModule,
        UnitsModule,
        RentersModule,
        LeasesModule,
        PaymentsModule,
        TenantModule,
        PlatformModule,
        BillingModule,
        SupportModule,
    ],
    controllers: [AppController],
    providers: [AppService],
})
export class AppModule {}
