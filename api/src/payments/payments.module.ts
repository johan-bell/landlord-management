import { Module } from '@nestjs/common';
import { AuthModule } from '../auth/auth.module';
import { LeasesModule } from '../leases/leases.module';
import { OrganizationsModule } from '../organizations/organizations.module';
import { OrgPaymentsListController } from './org-payments-list.controller';
import { PaymentsController } from './payments.controller';
import { PaymentsService } from './payments.service';

@Module({
    imports: [AuthModule, LeasesModule, OrganizationsModule],
    controllers: [PaymentsController, OrgPaymentsListController],
    providers: [PaymentsService],
})
export class PaymentsModule {}
