import {
    Body,
    Controller,
    ForbiddenException,
    Param,
    Post,
    UseGuards,
} from '@nestjs/common';
import { CurrentUser } from '../auth/decorators/current-user.decorator';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { OrgMembershipGuard } from '../auth/guards/org-membership.guard';
import type { RequestUser } from '../auth/types/jwt-payload';
import { OrgTeamService } from '../organizations/org-team.service';
import { BillingService } from './billing.service';
import { CheckoutDto } from './dto/checkout.dto';

@Controller('billing')
export class BillingController {
    constructor(
        private readonly billing: BillingService,
        private readonly orgTeam: OrgTeamService,
    ) {}

    @Post('organizations/:orgId/checkout')
    @UseGuards(JwtAuthGuard, OrgMembershipGuard)
    async checkout(
        @Param('orgId') orgId: string,
        @Body() dto: CheckoutDto,
        @CurrentUser() user: RequestUser,
    ) {
        if (user.typ !== 'staff' && user.typ !== 'platform') {
            throw new ForbiddenException();
        }
        await this.orgTeam.assertTeamManagerOrPlatform(orgId, user);
        return this.billing.createCheckoutSession(
            orgId,
            dto.successUrl,
            dto.cancelUrl,
        );
    }
}
