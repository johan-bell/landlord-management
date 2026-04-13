import { Body, Controller, Get, Param, Patch, Query, UseGuards } from '@nestjs/common';
import { SupportRequestStatus } from '@prisma/client';
import { CurrentUser } from '../auth/decorators/current-user.decorator';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { PlatformAdminGuard } from '../auth/guards/platform-admin.guard';
import type { RequestUser } from '../auth/types/jwt-payload';
import { UpdateSupportRequestDto } from './dto/update-support-request.dto';
import { SupportService } from './support.service';

@Controller('platform/support-requests')
@UseGuards(JwtAuthGuard, PlatformAdminGuard)
export class SupportPlatformController {
  constructor(private readonly support: SupportService) {}

  @Get()
  list(
    @Query('status') status?: SupportRequestStatus,
    @Query('organizationId') organizationId?: string,
  ) {
    return this.support.listForPlatform({ status, organizationId });
  }

  @Patch(':requestId')
  update(
    @Param('requestId') requestId: string,
    @CurrentUser() user: RequestUser,
    @Body() dto: UpdateSupportRequestDto,
  ) {
    return this.support.updateByPlatform(requestId, user, dto);
  }
}
