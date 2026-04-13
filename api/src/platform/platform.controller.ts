import { Body, Controller, Get, Param, Patch, UseGuards } from '@nestjs/common';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { PlatformAdminGuard } from '../auth/guards/platform-admin.guard';
import { SuspendOrganizationDto } from './dto/suspend-organization.dto';
import { PlatformService } from './platform.service';

@Controller('platform')
@UseGuards(JwtAuthGuard, PlatformAdminGuard)
export class PlatformController {
    constructor(private readonly platform: PlatformService) {}

    @Get('organizations')
    organizations() {
        return this.platform.listOrganizations();
    }

    @Get('organizations/:orgId')
    organization(@Param('orgId') orgId: string) {
        return this.platform.getOrganization(orgId);
    }

    @Patch('organizations/:orgId/suspend')
    suspend(
        @Param('orgId') orgId: string,
        @Body() dto: SuspendOrganizationDto,
    ) {
        return this.platform.setSuspended(orgId, dto.suspended);
    }
}
