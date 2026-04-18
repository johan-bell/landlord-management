import { Body, Controller, Post, UseGuards } from '@nestjs/common';
import { Throttle } from '@nestjs/throttler';
import { CurrentUser } from '../auth/decorators/current-user.decorator';
import { ForgotPasswordDto } from '../auth/dto/forgot-password.dto';
import { RefreshTokenDto } from '../auth/dto/refresh-token.dto';
import { ResetPasswordDto } from '../auth/dto/reset-password.dto';
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

    @Throttle({ default: { limit: 8, ttl: 60000 } })
    @Post('register')
    register(@Body() dto: TenantRegisterDto) {
        return this.tenantAuth.register(dto);
    }

    @Throttle({ default: { limit: 12, ttl: 60000 } })
    @Post('login')
    login(@Body() dto: TenantLoginDto) {
        return this.tenantAuth.login(dto);
    }

    @Throttle({ default: { limit: 30, ttl: 60000 } })
    @Post('refresh')
    refresh(@Body() dto: RefreshTokenDto) {
        return this.tenantAuth.refresh(dto);
    }

    @Throttle({ default: { limit: 4, ttl: 60000 } })
    @Post('forgot-password')
    forgotPassword(@Body() dto: ForgotPasswordDto) {
        return this.tenantAuth.requestPasswordReset(dto.email);
    }

    @Throttle({ default: { limit: 8, ttl: 60000 } })
    @Post('reset-password')
    resetPassword(@Body() dto: ResetPasswordDto) {
        return this.tenantAuth.resetPassword(dto);
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
