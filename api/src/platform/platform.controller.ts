import { Body, Controller, Get, Param, Patch, UseGuards } from '@nestjs/common';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { PlatformAdminGuard } from '../auth/guards/platform-admin.guard';
import { SuspendOrganizationDto } from './dto/suspend-organization.dto';
import { UpdatePlatformOrgNotesDto } from './dto/update-platform-org-notes.dto';
import { PlatformService } from './platform.service';

@Controller('platform')
@UseGuards(JwtAuthGuard, PlatformAdminGuard)
export class PlatformController {
    constructor(private readonly platform: PlatformService) {}

    @Get('health-overview')
    healthOverview() {
        return this.platform.getFleetHealthSnapshot();
    }

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

    @Patch('organizations/:orgId/internal-notes')
    internalNotes(
        @Param('orgId') orgId: string,
        @Body() dto: UpdatePlatformOrgNotesDto,
    ) {
        return this.platform.setInternalNotes(orgId, dto.notes ?? null);
    }
}
