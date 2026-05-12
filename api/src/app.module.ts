import { Module } from '@nestjs/common';
import { APP_GUARD, APP_INTERCEPTOR } from '@nestjs/core';
import { ConfigModule } from '@nestjs/config';
import { ScheduleModule } from '@nestjs/schedule';
import { ThrottlerGuard, ThrottlerModule } from '@nestjs/throttler';
import { LoggerModule } from 'nestjs-pino';
import { AuditModule } from './audit/audit.module';
import { AppController } from './app.controller';
import { AppService } from './app.service';
import { AuthModule } from './auth/auth.module';
import { BillingModule } from './billing/billing.module';
import { configValidationSchema } from './common/config/config.schema';
import { HttpLoggingInterceptor } from './common/http-logging.interceptor';
import { EmailModule } from './email/email.module';
import { HealthModule } from './health/health.module';
import { LeasesModule } from './leases/leases.module';
import { OrganizationsModule } from './organizations/organizations.module';
import { PaymentsModule } from './payments/payments.module';
import { PlatformModule } from './platform/platform.module';
import { PrismaModule } from './prisma/prisma.module';
import { ProofsModule } from './proofs/proofs.module';
import { PropertiesModule } from './properties/properties.module';
import { RenterDocumentsModule } from './renter-documents/renter-documents.module';
import { RentersModule } from './renters/renters.module';
import { RentReminderService } from './schedules/rent-reminder.service';
import { StorageModule } from './storage/storage.module';
import { SupportModule } from './support/support.module';
import { TenantModule } from './tenant/tenant.module';
import { UnitsModule } from './units/units.module';

@Module({
    imports: [
        ConfigModule.forRoot({
            isGlobal: true,
            envFilePath: ['.env', '.env.local'],
            validationSchema: configValidationSchema,
        }),
        LoggerModule.forRoot({
            pinoHttp: {
                transport:
                    process.env.NODE_ENV !== 'production'
                        ? {
                              target: 'pino-pretty',
                              options: { singleLine: true },
                          }
                        : undefined,
                autoLogging: false,
            },
        }),
        ThrottlerModule.forRoot([
            {
                ttl: 60000,
                limit: 200,
            },
        ]),
        ScheduleModule.forRoot(),
        AuditModule,
        StorageModule,
        EmailModule,
        PrismaModule,
        AuthModule,
        OrganizationsModule,
        PropertiesModule,
        UnitsModule,
        RentersModule,
        RenterDocumentsModule,
        LeasesModule,
        PaymentsModule,
        TenantModule,
        ProofsModule,
        PlatformModule,
        BillingModule,
        SupportModule,
        HealthModule,
    ],
    controllers: [AppController],
    providers: [
        AppService,
        RentReminderService,
        { provide: APP_GUARD, useClass: ThrottlerGuard },
        { provide: APP_INTERCEPTOR, useClass: HttpLoggingInterceptor },
    ],
})
export class AppModule {}
