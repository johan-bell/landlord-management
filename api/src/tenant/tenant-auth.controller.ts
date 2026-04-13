import { Body, Controller, Post, UseGuards } from '@nestjs/common';
import { CurrentUser } from '../auth/decorators/current-user.decorator';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { TenantOnlyGuard } from '../auth/guards/tenant-only.guard';
import type { RequestUser } from '../auth/types/jwt-payload';
import { TenantChangePasswordDto } from './dto/tenant-change-password.dto';
import { TenantAuthService } from './tenant-auth.service';
import { TenantLoginDto } from './dto/tenant-login.dto';
import { TenantRegisterDto } from './dto/tenant-register.dto';

@Controller('tenant/auth')
export class TenantAuthController {
  constructor(private readonly tenantAuth: TenantAuthService) {}

  @Post('register')
  register(@Body() dto: TenantRegisterDto) {
    return this.tenantAuth.register(dto);
  }

  @Post('login')
  login(@Body() dto: TenantLoginDto) {
    return this.tenantAuth.login(dto);
  }

  @Post('change-password')
  @UseGuards(JwtAuthGuard, TenantOnlyGuard)
  changePassword(
    @CurrentUser() user: RequestUser,
    @Body() dto: TenantChangePasswordDto,
  ) {
    return this.tenantAuth.changePassword(
      user.userId,
      dto.currentPassword,
      dto.newPassword,
    );
  }
}
