import { Controller, Get, Param, Query, UseGuards } from '@nestjs/common';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { OrgMembershipGuard } from '../auth/guards/org-membership.guard';
import { ListOrgPaymentsQueryDto } from './dto/list-org-payments.query';
import { PaymentsService } from './payments.service';

@Controller('organizations/:orgId/payments')
@UseGuards(JwtAuthGuard, OrgMembershipGuard)
export class OrgPaymentsListController {
    constructor(private readonly paymentsService: PaymentsService) {}

    @Get()
    listForOrg(
        @Param('orgId') orgId: string,
        @Query() query: ListOrgPaymentsQueryDto,
    ) {
        return this.paymentsService.listForOrganization(orgId, query);
    }
}
