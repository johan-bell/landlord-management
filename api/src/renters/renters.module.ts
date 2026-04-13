import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { AuthModule } from '../auth/auth.module';
import { OrganizationsModule } from '../organizations/organizations.module';
import { RentersController } from './renters.controller';
import { RentersService } from './renters.service';

@Module({
    imports: [ConfigModule, AuthModule, OrganizationsModule],
    controllers: [RentersController],
    providers: [RentersService],
    exports: [RentersService],
})
export class RentersModule {}
