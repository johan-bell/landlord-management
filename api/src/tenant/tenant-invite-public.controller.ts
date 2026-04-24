import { BadRequestException, Controller, Get, Query } from '@nestjs/common';
import { TenantAuthService } from './tenant-auth.service';

@Controller('tenant')
export class TenantInvitePublicController {
    constructor(private readonly tenantAuth: TenantAuthService) {}

    @Get('organizations/preview')
    previewOrg(@Query('id') id?: string) {
        if (!id?.trim()) {
            throw new BadRequestException('id query required');
        }
        return this.tenantAuth.previewOrganization(id);
    }
}
