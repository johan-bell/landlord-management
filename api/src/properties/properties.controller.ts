import { Body, Controller, Delete, Get, Param, Patch, Post, UseGuards } from '@nestjs/common';
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
  findAll(@Param('orgId') orgId: string) {
    return this.propertiesService.findAll(orgId);
  }

  @Get(':propertyId')
  findOne(@Param('orgId') orgId: string, @Param('propertyId') propertyId: string) {
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
  remove(@Param('orgId') orgId: string, @Param('propertyId') propertyId: string) {
    return this.propertiesService.remove(orgId, propertyId);
  }
}
