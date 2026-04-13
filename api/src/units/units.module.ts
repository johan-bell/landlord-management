import { Module } from '@nestjs/common';
import { AuthModule } from '../auth/auth.module';
import { PropertiesModule } from '../properties/properties.module';
import { UnitsController } from './units.controller';
import { UnitsService } from './units.service';

@Module({
    imports: [AuthModule, PropertiesModule],
    controllers: [UnitsController],
    providers: [UnitsService],
})
export class UnitsModule {}
