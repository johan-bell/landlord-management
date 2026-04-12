import {
  BadRequestException,
  Body,
  Controller,
  ForbiddenException,
  Get,
  Post,
  Query,
  UseGuards,
} from '@nestjs/common';
import { CurrentUser } from '../auth/decorators/current-user.decorator';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import type { RequestUser } from '../auth/types/jwt-payload';
import { AcceptInvitationDto } from './dto/accept-invitation.dto';
import { OrgTeamService } from './org-team.service';

@Controller('invitations')
export class InvitationsPublicController {
  constructor(private readonly team: OrgTeamService) {}

  /** Public: validate org invitation token (e.g. before sign-in). */
  @Get('organization')
  preview(@Query('token') token: string) {
    if (!token?.trim()) {
      throw new BadRequestException('token query required');
    }
    return this.team.previewInvitation(token.trim());
  }

  /** Authenticated staff user accepts invitation (email must match token). */
  @Post('organization/accept')
  @UseGuards(JwtAuthGuard)
  accept(@CurrentUser() user: RequestUser, @Body() dto: AcceptInvitationDto) {
    if (user.typ !== 'staff') {
      throw new ForbiddenException('Staff account required');
    }
    return this.team.acceptInvitation(dto.token.trim(), user.userId);
  }
}
