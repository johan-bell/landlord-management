import { Module } from '@nestjs/common';
import { AuthModule } from '../auth/auth.module';
import { OrganizationsModule } from '../organizations/organizations.module';
import { RentersModule } from '../renters/renters.module';
import { LeaseUtilitiesController } from './lease-utilities.controller';
import { LeaseUtilitiesService } from './lease-utilities.service';
import { LeasesController } from './leases.controller';
import { LeasesService } from './leases.service';

@Module({
    imports: [AuthModule, OrganizationsModule, RentersModule],
    controllers: [LeasesController, LeaseUtilitiesController],
    providers: [LeasesService, LeaseUtilitiesService],
    exports: [LeasesService, LeaseUtilitiesService],
})
export class LeasesModule {}
