import { Body, Controller, Post, UseGuards } from '@nestjs/common';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { TenantOnlyGuard } from '../auth/guards/tenant-only.guard';
import { CurrentUser } from '../auth/decorators/current-user.decorator';
import type { RequestUser } from '../auth/types/jwt-payload';
import { TenantProofAttachDto } from './dto/tenant-proof-attach.dto';
import { TenantProofUploadIntentDto } from './dto/tenant-proof-upload-intent.dto';
import { ProofsService } from './proofs.service';

@Controller('tenant/proofs')
@UseGuards(JwtAuthGuard, TenantOnlyGuard)
export class TenantProofsController {
    constructor(private readonly proofs: ProofsService) {}

    @Post('upload-intent')
    uploadIntent(
        @CurrentUser() user: RequestUser,
        @Body() dto: TenantProofUploadIntentDto,
    ) {
        return this.proofs.createUploadIntent(
            user,
            dto.organizationId,
            dto.contentType.trim(),
        );
    }

    @Post('attach')
    attach(@CurrentUser() user: RequestUser, @Body() dto: TenantProofAttachDto) {
        return this.proofs.attachProof(user, dto);
    }
}
