import { Body, Controller, ForbiddenException, Get, Param, Post, UseGuards } from '@nestjs/common';
import { CurrentUser } from '../auth/decorators/current-user.decorator';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { OrgMembershipGuard } from '../auth/guards/org-membership.guard';
import type { RequestUser } from '../auth/types/jwt-payload';
import { CreateSupportRequestDto } from './dto/create-support-request.dto';
import { SupportService } from './support.service';

@Controller('organizations/:orgId/support-requests')
@UseGuards(JwtAuthGuard, OrgMembershipGuard)
export class SupportOrgController {
  constructor(private readonly support: SupportService) {}

  @Get()
  list(@Param('orgId') orgId: string, @CurrentUser() user: RequestUser) {
    if (user.typ === 'tenant') {
      throw new ForbiddenException();
    }
    return this.support.listForOrganization(orgId, user);
  }

  @Post()
  create(
    @Param('orgId') orgId: string,
    @CurrentUser() user: RequestUser,
    @Body() dto: CreateSupportRequestDto,
  ) {
    if (user.typ === 'tenant') {
      throw new ForbiddenException();
    }
    return this.support.createForOrgMember(orgId, user, dto);
  }
}
