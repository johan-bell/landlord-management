import {
  Body,
  Controller,
  ForbiddenException,
  Get,
  Param,
  Post,
  UseGuards,
} from '@nestjs/common';
import { CurrentUser } from '../auth/decorators/current-user.decorator';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { OrgMembershipGuard } from '../auth/guards/org-membership.guard';
import type { RequestUser } from '../auth/types/jwt-payload';
import { ApproveTenantSignupDto } from './dto/approve-tenant-signup.dto';
import { TenantSignupsService } from './tenant-signups.service';

@Controller('organizations/:orgId/tenant-signups')
@UseGuards(JwtAuthGuard, OrgMembershipGuard)
export class TenantSignupsController {
  constructor(private readonly signups: TenantSignupsService) {}

  @Get()
  list(@Param('orgId') orgId: string, @CurrentUser() user: RequestUser) {
    if (user.typ !== 'staff' && user.typ !== 'platform') {
      throw new ForbiddenException();
    }
    return this.signups.listPending(orgId, user);
  }

  @Post(':requestId/approve')
  approve(
    @Param('orgId') orgId: string,
    @Param('requestId') requestId: string,
    @CurrentUser() user: RequestUser,
    @Body() dto: ApproveTenantSignupDto,
  ) {
    if (user.typ !== 'staff' && user.typ !== 'platform') {
      throw new ForbiddenException();
    }
    return this.signups.approve(orgId, requestId, user, dto);
  }

  @Post(':requestId/reject')
  reject(
    @Param('orgId') orgId: string,
    @Param('requestId') requestId: string,
    @CurrentUser() user: RequestUser,
  ) {
    if (user.typ !== 'staff' && user.typ !== 'platform') {
      throw new ForbiddenException();
    }
    return this.signups.reject(orgId, requestId, user);
  }
}
