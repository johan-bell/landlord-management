import {
    Body,
    Controller,
    Delete,
    Get,
    Param,
    Patch,
    Post,
    Query,
    UseGuards,
} from '@nestjs/common';
import { PaginationQueryDto } from '../common/dto/pagination-query.dto';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { OrgMembershipGuard } from '../auth/guards/org-membership.guard';
import { CreateRenterDto } from './dto/create-renter.dto';
import { UpdateRenterDto } from './dto/update-renter.dto';
import { RentersService } from './renters.service';

@Controller('organizations/:orgId/renters')
@UseGuards(JwtAuthGuard, OrgMembershipGuard)
export class RentersController {
    constructor(private readonly rentersService: RentersService) {}

    @Post()
    create(@Param('orgId') orgId: string, @Body() dto: CreateRenterDto) {
        return this.rentersService.create(orgId, dto);
    }

    @Get()
    findAll(@Param('orgId') orgId: string, @Query() query: PaginationQueryDto) {
        return this.rentersService.findAll(orgId, query);
    }

    /** Rent + utility charges across all leases for this renter (admin ledger). */
    @Get(':renterId/payment-history')
    paymentHistory(
        @Param('orgId') orgId: string,
        @Param('renterId') renterId: string,
    ) {
        return this.rentersService.getPaymentHistory(orgId, renterId);
    }

    @Post(':renterId/tenant-invite')
    tenantInvite(
        @Param('orgId') orgId: string,
        @Param('renterId') renterId: string,
    ) {
        return this.rentersService.createTenantInviteLink(orgId, renterId);
    }

    @Get(':renterId')
    findOne(
        @Param('orgId') orgId: string,
        @Param('renterId') renterId: string,
    ) {
        return this.rentersService.findOne(orgId, renterId);
    }

    @Patch(':renterId')
    update(
        @Param('orgId') orgId: string,
        @Param('renterId') renterId: string,
        @Body() dto: UpdateRenterDto,
    ) {
        return this.rentersService.update(orgId, renterId, dto);
    }

    @Delete(':renterId')
    remove(@Param('orgId') orgId: string, @Param('renterId') renterId: string) {
        return this.rentersService.remove(orgId, renterId);
    }
}
