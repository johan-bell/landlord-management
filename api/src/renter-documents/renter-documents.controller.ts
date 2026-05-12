import {
    Body,
    Controller,
    Delete,
    Get,
    Param,
    Post,
    UseGuards,
} from '@nestjs/common';
import { CurrentUser } from '../auth/decorators/current-user.decorator';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { OrgMembershipGuard } from '../auth/guards/org-membership.guard';
import type { RequestUser } from '../auth/types/jwt-payload';
import { AttachDocumentDto } from './dto/attach-document.dto';
import { DocumentUploadIntentDto } from './dto/upload-intent.dto';
import { RenterDocumentsService } from './renter-documents.service';

@Controller('organizations/:orgId/renters/:renterId/documents')
@UseGuards(JwtAuthGuard, OrgMembershipGuard)
export class RenterDocumentsController {
    constructor(private readonly svc: RenterDocumentsService) {}

    @Post('upload-intent')
    uploadIntent(
        @Param('orgId') orgId: string,
        @Param('renterId') renterId: string,
        @Body() dto: DocumentUploadIntentDto,
    ) {
        return this.svc.createUploadIntent(orgId, renterId, dto);
    }

    @Post()
    attach(
        @Param('orgId') orgId: string,
        @Param('renterId') renterId: string,
        @CurrentUser() user: RequestUser,
        @Body() dto: AttachDocumentDto,
    ) {
        return this.svc.attach(orgId, renterId, user.userId, dto);
    }

    @Get()
    list(
        @Param('orgId') orgId: string,
        @Param('renterId') renterId: string,
    ) {
        return this.svc.list(orgId, renterId);
    }

    @Get(':docId/download')
    download(
        @Param('orgId') orgId: string,
        @Param('renterId') renterId: string,
        @Param('docId') docId: string,
    ) {
        return this.svc.getDownloadUrl(orgId, renterId, docId);
    }

    @Delete(':docId')
    remove(
        @Param('orgId') orgId: string,
        @Param('renterId') renterId: string,
        @Param('docId') docId: string,
        @CurrentUser() user: RequestUser,
    ) {
        return this.svc.remove(orgId, renterId, docId, user.userId);
    }
}
