import { Module } from '@nestjs/common';
import { AuthModule } from '../auth/auth.module';
import { LeasesModule } from '../leases/leases.module';
import { OrganizationsModule } from '../organizations/organizations.module';
import { PaymentsController } from './payments.controller';
import { PaymentsService } from './payments.service';

@Module({
    imports: [AuthModule, LeasesModule, OrganizationsModule],
    controllers: [PaymentsController],
    providers: [PaymentsService],
})
export class PaymentsModule {}
