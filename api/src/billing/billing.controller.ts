import { Body, Controller, Param, Post, UseGuards } from '@nestjs/common';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { OrgMembershipGuard } from '../auth/guards/org-membership.guard';
import { BillingService } from './billing.service';
import { CheckoutDto } from './dto/checkout.dto';

@Controller('billing')
export class BillingController {
  constructor(private readonly billing: BillingService) {}

  @Post('organizations/:orgId/checkout')
  @UseGuards(JwtAuthGuard, OrgMembershipGuard)
  checkout(@Param('orgId') orgId: string, @Body() dto: CheckoutDto) {
    return this.billing.createCheckoutSession(
      orgId,
      dto.successUrl,
      dto.cancelUrl,
    );
  }
}
