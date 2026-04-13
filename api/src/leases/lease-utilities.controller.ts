import {
    Body,
    Controller,
    Delete,
    Get,
    Param,
    Patch,
    Post,
    UseGuards,
} from '@nestjs/common';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { OrgMembershipGuard } from '../auth/guards/org-membership.guard';
import { CreateLeaseUtilityBillDto } from './dto/create-lease-utility-bill.dto';
import { UpdateLeaseUtilityBillDto } from './dto/update-lease-utility-bill.dto';
import { LeaseUtilitiesService } from './lease-utilities.service';

@Controller('organizations/:orgId/leases/:leaseId/utility-bills')
@UseGuards(JwtAuthGuard, OrgMembershipGuard)
export class LeaseUtilitiesController {
    constructor(private readonly utilities: LeaseUtilitiesService) {}

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
    patch(
        @Param('orgId') orgId: string,
        @Param('leaseId') leaseId: string,
        @Param('billId') billId: string,
        @Body() dto: UpdateLeaseUtilityBillDto,
    ) {
        return this.utilities.update(orgId, leaseId, billId, dto);
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
