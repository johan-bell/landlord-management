import {
    Body,
    Controller,
    Delete,
    Get,
    Param,
    Patch,
    Post,
    Query,
    UseGuards,
} from '@nestjs/common';
import { PaginationQueryDto } from '../common/dto/pagination-query.dto';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { OrgMembershipGuard } from '../auth/guards/org-membership.guard';
import { CreateUnitDto } from './dto/create-unit.dto';
import { UpdateUnitDto } from './dto/update-unit.dto';
import { UnitsService } from './units.service';

@Controller('organizations/:orgId/properties/:propertyId/units')
@UseGuards(JwtAuthGuard, OrgMembershipGuard)
export class UnitsController {
    constructor(private readonly unitsService: UnitsService) {}

    @Post()
    create(
        @Param('orgId') orgId: string,
        @Param('propertyId') propertyId: string,
        @Body() dto: CreateUnitDto,
    ) {
        return this.unitsService.create(orgId, propertyId, dto);
    }

    @Get()
    findAll(
        @Param('orgId') orgId: string,
        @Param('propertyId') propertyId: string,
        @Query() query: PaginationQueryDto,
    ) {
        return this.unitsService.findAll(orgId, propertyId, query);
    }

    @Get(':unitId')
    findOne(
        @Param('orgId') orgId: string,
        @Param('propertyId') propertyId: string,
        @Param('unitId') unitId: string,
    ) {
        return this.unitsService.findOne(orgId, propertyId, unitId);
    }

    @Patch(':unitId')
    update(
        @Param('orgId') orgId: string,
        @Param('propertyId') propertyId: string,
        @Param('unitId') unitId: string,
        @Body() dto: UpdateUnitDto,
    ) {
        return this.unitsService.update(orgId, propertyId, unitId, dto);
    }

    @Delete(':unitId')
    remove(
        @Param('orgId') orgId: string,
        @Param('propertyId') propertyId: string,
        @Param('unitId') unitId: string,
    ) {
        return this.unitsService.remove(orgId, propertyId, unitId);
    }
}
