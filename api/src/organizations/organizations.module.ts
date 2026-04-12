import { Module } from '@nestjs/common';
import { AuthModule } from '../auth/auth.module';
import { InvitationsPublicController } from './invitations-public.controller';
import { OrgTeamController } from './org-team.controller';
import { OrgTeamService } from './org-team.service';
import { OrganizationsController } from './organizations.controller';
import { OrganizationsService } from './organizations.service';

@Module({
  imports: [AuthModule],
  controllers: [OrganizationsController, OrgTeamController, InvitationsPublicController],
  providers: [OrganizationsService, OrgTeamService],
  exports: [OrganizationsService, OrgTeamService],
})
export class OrganizationsModule {}
