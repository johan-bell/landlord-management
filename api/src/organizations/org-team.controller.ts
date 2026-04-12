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
import { CreateInvitationDto } from './dto/create-invitation.dto';
import { UpdateMemberRoleDto } from './dto/update-member-role.dto';
import { OrgTeamService } from './org-team.service';

@Controller('organizations/:orgId')
@UseGuards(JwtAuthGuard, OrgMembershipGuard)
export class OrgTeamController {
  constructor(private readonly team: OrgTeamService) {}

  @Get('members')
  listMembers(@Param('orgId') orgId: string, @CurrentUser() user: RequestUser) {
    if (user.typ !== 'staff') {
      throw new ForbiddenException();
    }
    return this.team.listMembers(orgId, user.userId);
  }

  @Patch('members/:memberId')
  updateRole(
    @Param('orgId') orgId: string,
    @Param('memberId') memberId: string,
    @CurrentUser() user: RequestUser,
    @Body() dto: UpdateMemberRoleDto,
  ) {
    if (user.typ !== 'staff') {
      throw new ForbiddenException();
    }
    return this.team.updateMemberRole(orgId, memberId, user.userId, dto.role);
  }

  @Delete('members/:memberId')
  removeMember(
    @Param('orgId') orgId: string,
    @Param('memberId') memberId: string,
    @CurrentUser() user: RequestUser,
  ) {
    if (user.typ !== 'staff') {
      throw new ForbiddenException();
    }
    return this.team.removeMember(orgId, memberId, user.userId);
  }

  @Get('invitations')
  listInvitations(@Param('orgId') orgId: string, @CurrentUser() user: RequestUser) {
    if (user.typ !== 'staff') {
      throw new ForbiddenException();
    }
    return this.team.listInvitations(orgId, user.userId);
  }

  @Post('invitations')
  createInvitation(
    @Param('orgId') orgId: string,
    @CurrentUser() user: RequestUser,
    @Body() dto: CreateInvitationDto,
  ) {
    if (user.typ !== 'staff') {
      throw new ForbiddenException();
    }
    return this.team.createInvitation(orgId, user.userId, dto.email, dto.role);
  }

  @Delete('invitations/:invitationId')
  deleteInvitation(
    @Param('orgId') orgId: string,
    @Param('invitationId') invitationId: string,
    @CurrentUser() user: RequestUser,
  ) {
    if (user.typ !== 'staff') {
      throw new ForbiddenException();
    }
    return this.team.deleteInvitation(orgId, invitationId, user.userId);
  }
}
