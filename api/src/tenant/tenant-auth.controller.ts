import { Body, Controller, Post } from '@nestjs/common';
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
}
