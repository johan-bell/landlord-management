import { Controller, Get, UseGuards } from '@nestjs/common';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { TenantOnlyGuard } from '../auth/guards/tenant-only.guard';
import type { RequestUser } from '../auth/types/jwt-payload';
import { CurrentUser } from '../auth/decorators/current-user.decorator';
import { TenantPortalService } from './tenant-portal.service';

@Controller('tenant')
@UseGuards(JwtAuthGuard, TenantOnlyGuard)
export class TenantPortalController {
  constructor(private readonly portal: TenantPortalService) {}

  @Get('me')
  me(@CurrentUser() user: RequestUser) {
    return this.portal.getMe(user);
  }

  @Get('leases')
  leases(@CurrentUser() user: RequestUser) {
    return this.portal.getLeases(user);
  }
}
