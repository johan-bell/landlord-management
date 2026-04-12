import { BadRequestException, Controller, Get, Query } from '@nestjs/common';
import { TenantAuthService } from './tenant-auth.service';

@Controller('tenant')
export class TenantInvitePublicController {
  constructor(private readonly tenantAuth: TenantAuthService) {}

  /** Public: validate renter invite token (from landlord “copy link”). */
  @Get('invites/preview')
  preview(@Query('token') token: string) {
    if (!token?.trim()) {
      throw new BadRequestException('token query required');
    }
    return this.tenantAuth.previewInvite(token.trim());
  }
}
