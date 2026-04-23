import { Injectable } from '@nestjs/common';
import { PrismaService } from './prisma/prisma.service';
import { ObjectStorageService } from './storage/object-storage.service';
import { EmailService } from './email/email.service';

@Injectable()
export class AppService {
    constructor(
        private readonly prisma: PrismaService,
        private readonly storage: ObjectStorageService,
        private readonly email: EmailService,
    ) {}

    async getHealth() {
        let database: 'ok' | 'error' = 'ok';
        try {
            await this.prisma.$queryRaw`SELECT 1`;
        } catch {
            database = 'error';
        }

        const storage = this.storage.isConfigured() ? 'configured' : 'disabled';
        const emailStatus = this.email.isConfigured() ? 'configured' : 'disabled';
        const ok = database === 'ok';

        return {
            ok,
            service: 'landlord-management-api',
            version: '0.1.0',
            database,
            storage,
            email: emailStatus,
            time: new Date().toISOString(),
        };
    }
}
