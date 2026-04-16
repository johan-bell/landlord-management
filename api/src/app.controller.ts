import { Controller, Get } from '@nestjs/common';
import { AppService } from './app.service';

@Controller()
export class AppController {
    constructor(private readonly appService: AppService) {}

    @Get()
    root() {
        return this.appService.getHealth();
    }

    @Get('health')
    health() {
        return this.appService.getHealth();
    }

    /** Async alias for probes that should verify dependencies (e.g. database). */
    @Get('health/ready')
    async ready() {
        return this.appService.getHealth();
    }
}
