import { Module } from '@nestjs/common';
import { AuthModule } from '../auth/auth.module';
import { OrganizationsModule } from '../organizations/organizations.module';
import { PropertiesController } from './properties.controller';
import { PropertiesService } from './properties.service';

@Module({
    imports: [AuthModule, OrganizationsModule],
    controllers: [PropertiesController],
    providers: [PropertiesService],
    exports: [PropertiesService],
})
export class PropertiesModule {}
