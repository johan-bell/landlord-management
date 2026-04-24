import { Controller, Get } from '@nestjs/common';
import {
    HealthCheck,
    HealthCheckService,
    PrismaHealthIndicator,
} from '@nestjs/terminus';
import { HealthService } from './health.service';
import { PrismaService } from '../prisma/prisma.service';

@Controller('health')
export class HealthController {
    constructor(
        private readonly health: HealthCheckService,
        private readonly prismaHealth: PrismaHealthIndicator,
        private readonly prisma: PrismaService,
        private readonly healthService: HealthService,
    ) {}

    @Get()
    @HealthCheck()
    check() {
        return this.health.check([
            () => this.prismaHealth.pingCheck('database', this.prisma),
            () => this.healthService.checkSmtp(),
            () => this.healthService.checkMinio(),
        ]);
    }
}
