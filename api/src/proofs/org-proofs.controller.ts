import {
    Body,
    Controller,
    Get,
    Param,
    Post,
    Query,
    UseGuards,
} from '@nestjs/common';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { OrgMembershipGuard } from '../auth/guards/org-membership.guard';
import { CurrentUser } from '../auth/decorators/current-user.decorator';
import type { RequestUser } from '../auth/types/jwt-payload';
import { RejectProofDto } from './dto/reject-proof.dto';
import { ProofsService } from './proofs.service';

@Controller('organizations/:orgId/proofs')
@UseGuards(JwtAuthGuard, OrgMembershipGuard)
export class OrgProofsController {
    constructor(private readonly proofs: ProofsService) {}

    @Get('pending')
    pending(@Param('orgId') orgId: string) {
        return this.proofs.listPendingForOrg(orgId);
    }

    @Get('view')
    view(@Param('orgId') orgId: string, @Query('key') key: string) {
        if (!key?.trim()) {
            return { viewUrl: null };
        }
        return this.proofs.getViewUrlForOrg(orgId, key.trim());
    }

    @Post('payments/:paymentId/approve')
    approveRent(
        @Param('orgId') orgId: string,
        @Param('paymentId') paymentId: string,
        @CurrentUser() user: RequestUser,
    ) {
        return this.proofs.approveRentPayment(orgId, user.userId, paymentId);
    }

    @Post('payments/:paymentId/reject')
    rejectRent(
        @Param('orgId') orgId: string,
        @Param('paymentId') paymentId: string,
        @CurrentUser() user: RequestUser,
        @Body() dto: RejectProofDto,
    ) {
        return this.proofs.rejectRentPayment(
            orgId,
            user.userId,
            paymentId,
            dto.note,
        );
    }

    @Post('utility-bills/:billId/approve')
    approveUtility(
        @Param('orgId') orgId: string,
        @Param('billId') billId: string,
        @CurrentUser() user: RequestUser,
    ) {
        return this.proofs.approveUtilityBill(orgId, user.userId, billId);
    }

    @Post('utility-bills/:billId/reject')
    rejectUtility(
        @Param('orgId') orgId: string,
        @Param('billId') billId: string,
        @CurrentUser() user: RequestUser,
        @Body() dto: RejectProofDto,
    ) {
        return this.proofs.rejectUtilityBill(
            orgId,
            user.userId,
            billId,
            dto.note,
        );
    }
}
