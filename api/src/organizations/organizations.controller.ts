import {
    Body,
    Controller,
    Delete,
    ForbiddenException,
    Get,
    Param,
    Patch,
    Post,
    Query,
    StreamableFile,
    UseGuards,
} from '@nestjs/common';
import { IsIn } from 'class-validator';
import {
    PaginationQueryDto,
    parsePagination,
} from '../common/dto/pagination-query.dto';
import { CurrentUser } from '../auth/decorators/current-user.decorator';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { OrgMembershipGuard } from '../auth/guards/org-membership.guard';
import type { RequestUser } from '../auth/types/jwt-payload';
import { AuditService } from '../audit/audit.service';
import { CreateOrganizationDto } from './dto/create-organization.dto';
import { UpdateOrganizationDto } from './dto/update-organization.dto';
import { OrgTeamService } from './org-team.service';
import { OrganizationsService } from './organizations.service';

@Controller('organizations')
export class OrganizationsController {
    constructor(
        private readonly organizationsService: OrganizationsService,
        private readonly orgTeam: OrgTeamService,
        private readonly audit: AuditService,
    ) {}

    @Post()
    @UseGuards(JwtAuthGuard)
    create(
        @CurrentUser() user: RequestUser,
        @Body() dto: CreateOrganizationDto,
    ) {
        if (user.typ !== 'staff' && user.typ !== 'platform') {
            throw new ForbiddenException();
        }
        return this.organizationsService.createForUser(user.userId, dto);
    }

    @Get()
    @UseGuards(JwtAuthGuard)
    findAll(@CurrentUser() user: RequestUser) {
        if (user.typ === 'tenant') {
            throw new ForbiddenException();
        }
        return this.organizationsService.findAllForUser(user.userId);
    }

    @Get(':orgId/summary')
    @UseGuards(JwtAuthGuard, OrgMembershipGuard)
    summary(@Param('orgId') orgId: string) {
        return this.organizationsService.summary(orgId);
    }

    @Get(':orgId/onboarding-status')
    @UseGuards(JwtAuthGuard, OrgMembershipGuard)
    onboardingStatus(@Param('orgId') orgId: string) {
        return this.organizationsService.getOnboardingStatus(orgId);
    }

    @Get(':orgId/analytics')
    @UseGuards(JwtAuthGuard, OrgMembershipGuard)
    analytics(@Param('orgId') orgId: string) {
        return this.organizationsService.analytics(orgId);
    }

    @Get(':orgId/audit-logs')
    @UseGuards(JwtAuthGuard, OrgMembershipGuard)
    async auditLogs(
        @Param('orgId') orgId: string,
        @CurrentUser() user: RequestUser,
        @Query() query: PaginationQueryDto,
    ) {
        await this.orgTeam.assertTeamManagerOrPlatform(orgId, user);
        const { page, limit } = parsePagination(query);
        return this.audit.listForOrg(orgId, page, limit);
    }

    @Get(':orgId/exports/rent-roll')
    @UseGuards(JwtAuthGuard, OrgMembershipGuard)
    async rentRollExport(
        @Param('orgId') orgId: string,
        @CurrentUser() user: RequestUser,
    ) {
        if (user.typ !== 'staff' && user.typ !== 'platform') {
            throw new ForbiddenException();
        }
        await this.orgTeam.assertTeamManagerOrPlatform(orgId, user);
        const csv = await this.organizationsService.buildRentRollCsv(orgId);
        const buf = Buffer.from(csv, 'utf-8');
        return new StreamableFile(buf, {
            type: 'text/csv; charset=utf-8',
            disposition: 'attachment; filename="rent-roll.csv"',
        });
    }

    @Get(':orgId')
    @UseGuards(JwtAuthGuard, OrgMembershipGuard)
    findOne(@Param('orgId') orgId: string) {
        return this.organizationsService.findOneOrThrow(orgId);
    }

    @Patch(':orgId')
    @UseGuards(JwtAuthGuard, OrgMembershipGuard)
    async update(
        @Param('orgId') orgId: string,
        @Body() dto: UpdateOrganizationDto,
        @CurrentUser() user: RequestUser,
    ) {
        if (user.typ !== 'staff' && user.typ !== 'platform') {
            throw new ForbiddenException();
        }
        await this.orgTeam.assertTeamManagerOrPlatform(orgId, user);
        return this.organizationsService.update(
            orgId,
            dto,
            user.typ === 'staff' ? user.userId : undefined,
        );
    }

    @Post(':orgId/bulk-actions/send-reminders')
    @UseGuards(JwtAuthGuard, OrgMembershipGuard)
    async sendBulkReminders(
        @Param('orgId') orgId: string,
        @CurrentUser() user: RequestUser,
        @Body() body: { type: 'PENDING' | 'LATE' },
    ) {
        if (user.typ !== 'staff' && user.typ !== 'platform') {
            throw new ForbiddenException();
        }
        await this.orgTeam.assertTeamManagerOrPlatform(orgId, user);
        const type = body.type === 'LATE' ? 'LATE' : 'PENDING';
        return this.organizationsService.sendBulkReminders(orgId, type);
    }

    @Delete(':orgId')
    @UseGuards(JwtAuthGuard, OrgMembershipGuard)
    async remove(
        @Param('orgId') orgId: string,
        @CurrentUser() user: RequestUser,
    ) {
        if (user.typ !== 'staff' && user.typ !== 'platform') {
            throw new ForbiddenException();
        }
        await this.orgTeam.assertOwnerOrPlatform(orgId, user);
        return this.organizationsService.remove(
            orgId,
            user.typ === 'staff' ? user.userId : undefined,
        );
    }
}
