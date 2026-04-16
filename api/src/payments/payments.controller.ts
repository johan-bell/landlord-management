import {
    Body,
    Controller,
    Delete,
    ForbiddenException,
    Get,
    Param,
    Patch,
    Post,
    UseGuards,
} from '@nestjs/common';
import { PaymentStatus } from '@prisma/client';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { OrgMembershipGuard } from '../auth/guards/org-membership.guard';
import { CurrentUser } from '../auth/decorators/current-user.decorator';
import type { RequestUser } from '../auth/types/jwt-payload';
import { OrgTeamService } from '../organizations/org-team.service';
import { CreatePaymentDto } from './dto/create-payment.dto';
import { UpdatePaymentDto } from './dto/update-payment.dto';
import { PaymentsService } from './payments.service';

@Controller('organizations/:orgId/leases/:leaseId/payments')
@UseGuards(JwtAuthGuard, OrgMembershipGuard)
export class PaymentsController {
    constructor(
        private readonly paymentsService: PaymentsService,
        private readonly orgTeam: OrgTeamService,
    ) {}

    @Post()
    create(
        @Param('orgId') orgId: string,
        @Param('leaseId') leaseId: string,
        @Body() dto: CreatePaymentDto,
    ) {
        return this.paymentsService.create(orgId, leaseId, dto);
    }

    @Get()
    findAll(@Param('orgId') orgId: string, @Param('leaseId') leaseId: string) {
        return this.paymentsService.findAll(orgId, leaseId);
    }

    @Get(':paymentId')
    findOne(
        @Param('orgId') orgId: string,
        @Param('leaseId') leaseId: string,
        @Param('paymentId') paymentId: string,
    ) {
        return this.paymentsService.findOne(orgId, leaseId, paymentId);
    }

    @Patch(':paymentId')
    async update(
        @Param('orgId') orgId: string,
        @Param('leaseId') leaseId: string,
        @Param('paymentId') paymentId: string,
        @Body() dto: UpdatePaymentDto,
        @CurrentUser() user: RequestUser,
    ) {
        if (user.typ !== 'staff' && user.typ !== 'platform') {
            throw new ForbiddenException();
        }
        if (dto.status === PaymentStatus.PAID) {
            await this.orgTeam.assertTeamManagerOrPlatform(orgId, user);
        }
        const staffId = user.typ === 'staff' ? user.userId : undefined;
        return this.paymentsService.update(
            orgId,
            leaseId,
            paymentId,
            dto,
            staffId,
        );
    }

    @Delete(':paymentId')
    remove(
        @Param('orgId') orgId: string,
        @Param('leaseId') leaseId: string,
        @Param('paymentId') paymentId: string,
    ) {
        return this.paymentsService.remove(orgId, leaseId, paymentId);
    }
}
