import { Body, Controller, Get, Param, Post, UseGuards } from '@nestjs/common';
import { IsIn, IsString } from 'class-validator';
import { CurrentUser } from '../auth/decorators/current-user.decorator';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { TenantOnlyGuard } from '../auth/guards/tenant-only.guard';
import type { RequestUser } from '../auth/types/jwt-payload';
import { CreateSupportRequestDto } from './dto/create-support-request.dto';
import { SupportService } from './support.service';

const PHOTO_TYPES = ['image/jpeg', 'image/png', 'image/webp'] as const;

class PhotoUploadIntentDto {
    @IsString()
    organizationId!: string;

    @IsIn(PHOTO_TYPES)
    contentType!: string;
}

class AttachPhotoDto {
    @IsString()
    organizationId!: string;

    @IsString()
    objectKey!: string;

    @IsIn(PHOTO_TYPES)
    contentType!: string;
}

@Controller('tenant/support-requests')
@UseGuards(JwtAuthGuard, TenantOnlyGuard)
export class SupportTenantController {
    constructor(private readonly support: SupportService) {}

    @Get()
    list(@CurrentUser() user: RequestUser) {
        return this.support.listMineForTenant(user);
    }

    @Post()
    create(
        @CurrentUser() user: RequestUser,
        @Body() dto: CreateSupportRequestDto,
    ) {
        return this.support.createForTenant(user, dto);
    }

    @Post(':requestId/photo/upload-intent')
    photoUploadIntent(
        @Param('requestId') requestId: string,
        @CurrentUser() user: RequestUser,
        @Body() dto: PhotoUploadIntentDto,
    ) {
        return this.support.createPhotoUploadIntent(
            requestId,
            dto.organizationId,
            user,
            dto.contentType,
        );
    }

    @Post(':requestId/photo/attach')
    attachPhoto(
        @Param('requestId') requestId: string,
        @CurrentUser() user: RequestUser,
        @Body() dto: AttachPhotoDto,
    ) {
        return this.support.attachPhoto(
            requestId,
            user,
            dto.organizationId,
            dto.objectKey,
            dto.contentType,
        );
    }
}
