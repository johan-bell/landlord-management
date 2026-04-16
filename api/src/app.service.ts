import { Injectable } from '@nestjs/common';
import { PrismaService } from './prisma/prisma.service';

@Injectable()
export class AppService {
    constructor(private readonly prisma: PrismaService) {}

    async getHealth() {
        let database: 'ok' | 'error' = 'ok';
        try {
            await this.prisma.$queryRaw`SELECT 1`;
        } catch {
            database = 'error';
        }
        const ok = database === 'ok';
        return {
            ok,
            service: 'landlord-management-api',
            version: '0.1.0',
            database,
            time: new Date().toISOString(),
        };
    }
}
