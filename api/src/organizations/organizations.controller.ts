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
import { CurrentUser } from '../auth/decorators/current-user.decorator';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { OrgMembershipGuard } from '../auth/guards/org-membership.guard';
import type { RequestUser } from '../auth/types/jwt-payload';
import { CreateOrganizationDto } from './dto/create-organization.dto';
import { UpdateOrganizationDto } from './dto/update-organization.dto';
import { OrgTeamService } from './org-team.service';
import { OrganizationsService } from './organizations.service';

@Controller('organizations')
export class OrganizationsController {
    constructor(
        private readonly organizationsService: OrganizationsService,
        private readonly orgTeam: OrgTeamService,
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
        return this.organizationsService.update(orgId, dto);
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
        return this.organizationsService.remove(orgId);
    }
}
