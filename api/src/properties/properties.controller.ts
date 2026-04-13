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
import { CreatePropertyDto } from './dto/create-property.dto';
import { UpdatePropertyDto } from './dto/update-property.dto';
import { PropertiesService } from './properties.service';

@Controller('organizations/:orgId/properties')
@UseGuards(JwtAuthGuard, OrgMembershipGuard)
export class PropertiesController {
  constructor(private readonly propertiesService: PropertiesService) {}

  @Post()
  create(@Param('orgId') orgId: string, @Body() dto: CreatePropertyDto) {
    return this.propertiesService.create(orgId, dto);
  }

  @Get()
  findAll(@Param('orgId') orgId: string, @Query() query: PaginationQueryDto) {
    return this.propertiesService.findAll(orgId, query);
  }

  @Get(':propertyId')
  findOne(
    @Param('orgId') orgId: string,
    @Param('propertyId') propertyId: string,
  ) {
    return this.propertiesService.findOne(orgId, propertyId);
  }

  @Patch(':propertyId')
  update(
    @Param('orgId') orgId: string,
    @Param('propertyId') propertyId: string,
    @Body() dto: UpdatePropertyDto,
  ) {
    return this.propertiesService.update(orgId, propertyId, dto);
  }

  @Delete(':propertyId')
  remove(
    @Param('orgId') orgId: string,
    @Param('propertyId') propertyId: string,
  ) {
    return this.propertiesService.remove(orgId, propertyId);
  }
}
