import { Body, Controller, Get, Post, UseGuards } from '@nestjs/common';
import { CurrentUser } from '../auth/decorators/current-user.decorator';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { TenantOnlyGuard } from '../auth/guards/tenant-only.guard';
import type { RequestUser } from '../auth/types/jwt-payload';
import { CreateSupportRequestDto } from './dto/create-support-request.dto';
import { SupportService } from './support.service';

@Controller('tenant/support-requests')
@UseGuards(JwtAuthGuard, TenantOnlyGuard)
export class SupportTenantController {
  constructor(private readonly support: SupportService) {}

  @Get()
  list(@CurrentUser() user: RequestUser) {
    return this.support.listMineForTenant(user);
  }

  @Post()
  create(@CurrentUser() user: RequestUser, @Body() dto: CreateSupportRequestDto) {
    return this.support.createForTenant(user, dto);
  }
}
