import { Module } from '@nestjs/common';
import { AuthModule } from '../auth/auth.module';
import { OrganizationsModule } from '../organizations/organizations.module';
import { RentersController } from './renters.controller';
import { RentersService } from './renters.service';

@Module({
  imports: [AuthModule, OrganizationsModule],
  controllers: [RentersController],
  providers: [RentersService],
  exports: [RentersService],
})
export class RentersModule {}
