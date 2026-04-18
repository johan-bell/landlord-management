import { Module } from '@nestjs/common';
import { AuthModule } from '../auth/auth.module';
import { EmailModule } from '../email/email.module';
import { InvitationsPublicController } from './invitations-public.controller';
import { OrgTeamController } from './org-team.controller';
import { OrgTeamService } from './org-team.service';
import { OrganizationsController } from './organizations.controller';
import { OrganizationsService } from './organizations.service';
import { TenantSignupsController } from './tenant-signups.controller';
import { TenantSignupsService } from './tenant-signups.service';

@Module({
    imports: [AuthModule, EmailModule],
    controllers: [
        OrganizationsController,
        OrgTeamController,
        InvitationsPublicController,
        TenantSignupsController,
    ],
    providers: [OrganizationsService, OrgTeamService, TenantSignupsService],
    exports: [OrganizationsService, OrgTeamService, TenantSignupsService],
})
export class OrganizationsModule {}
