import {
    Body,
    Controller,
    Delete,
    ForbiddenException,
    Get,
    Param,
    Patch,
    Post,
    UseGuards,
} from '@nestjs/common';
import { CurrentUser } from '../auth/decorators/current-user.decorator';
import type { RequestUser } from '../auth/types/jwt-payload';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { OrgMembershipGuard } from '../auth/guards/org-membership.guard';
import { OrgTeamService } from '../organizations/org-team.service';
import { CreateLeaseUtilityBillDto } from './dto/create-lease-utility-bill.dto';
import { UpdateLeaseUtilityBillDto } from './dto/update-lease-utility-bill.dto';
import { LeaseUtilitiesService } from './lease-utilities.service';

@Controller('organizations/:orgId/leases/:leaseId/utility-bills')
@UseGuards(JwtAuthGuard, OrgMembershipGuard)
export class LeaseUtilitiesController {
    constructor(
        private readonly utilities: LeaseUtilitiesService,
        private readonly orgTeam: OrgTeamService,
    ) {}

    @Get()
    list(@Param('orgId') orgId: string, @Param('leaseId') leaseId: string) {
        return this.utilities.list(orgId, leaseId);
    }

    @Post()
    upsert(
        @Param('orgId') orgId: string,
        @Param('leaseId') leaseId: string,
        @Body() dto: CreateLeaseUtilityBillDto,
    ) {
        return this.utilities.upsert(orgId, leaseId, dto);
    }

    @Patch(':billId')
    async patch(
        @Param('orgId') orgId: string,
        @Param('leaseId') leaseId: string,
        @Param('billId') billId: string,
        @Body() dto: UpdateLeaseUtilityBillDto,
        @CurrentUser() user: RequestUser,
    ) {
        if (user.typ !== 'staff' && user.typ !== 'platform') {
            throw new ForbiddenException();
        }
        if (dto.status !== undefined) {
            await this.orgTeam.assertTeamManagerOrPlatform(orgId, user);
        }
        const staffId = user.typ === 'staff' ? user.userId : undefined;
        return this.utilities.update(orgId, leaseId, billId, dto, staffId);
    }

    @Delete(':billId')
    remove(
        @Param('orgId') orgId: string,
        @Param('leaseId') leaseId: string,
        @Param('billId') billId: string,
    ) {
        return this.utilities.remove(orgId, leaseId, billId);
    }
}
