import { Module } from '@nestjs/common';
import { TerminusModule } from '@nestjs/terminus';
import { HealthController } from './health.controller';
import { HealthService } from './health.service';
import { PrismaModule } from '../prisma/prisma.module';
import { EmailModule } from '../email/email.module';

@Module({
    imports: [TerminusModule, PrismaModule, EmailModule],
    controllers: [HealthController],
    providers: [HealthService],
})
export class HealthModule {}
