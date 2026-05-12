import { Controller, Get, Param, UseGuards } from '@nestjs/common';
import { CurrentUser } from '../auth/decorators/current-user.decorator';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { TenantOnlyGuard } from '../auth/guards/tenant-only.guard';
import type { RequestUser } from '../auth/types/jwt-payload';
import { RenterDocumentsService } from '../renter-documents/renter-documents.service';
import { PrismaService } from '../prisma/prisma.service';
import { ForbiddenException } from '@nestjs/common';

@Controller('tenant/documents')
@UseGuards(JwtAuthGuard, TenantOnlyGuard)
export class TenantDocumentsController {
    constructor(
        private readonly docs: RenterDocumentsService,
        private readonly prisma: PrismaService,
    ) {}

    private async resolveRenterId(user: RequestUser): Promise<string> {
        let renterId = user.renterId;
        if (!renterId) {
            const r = await this.prisma.renter.findFirst({
                where: { userId: user.userId, deletedAt: null },
            });
            renterId = r?.id;
        }
        if (!renterId) {
            throw new ForbiddenException('Renter profile required');
        }
        return renterId;
    }

    @Get()
    async list(@CurrentUser() user: RequestUser) {
        const renterId = await this.resolveRenterId(user);
        return this.docs.listForTenant(renterId);
    }

    @Get(':docId/download')
    async download(
        @CurrentUser() user: RequestUser,
        @Param('docId') docId: string,
    ) {
        const renterId = await this.resolveRenterId(user);
        return this.docs.getTenantDownloadUrl(renterId, docId);
    }
}
