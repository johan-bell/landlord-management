import { Body, Controller, Delete, Get, Param, Patch, Post, UseGuards } from '@nestjs/common';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { OrgMembershipGuard } from '../auth/guards/org-membership.guard';
import { CreateRenterDto } from './dto/create-renter.dto';
import { UpdateRenterDto } from './dto/update-renter.dto';
import { RentersService } from './renters.service';

@Controller('organizations/:orgId/renters')
@UseGuards(JwtAuthGuard, OrgMembershipGuard)
export class RentersController {
  constructor(private readonly rentersService: RentersService) {}

  @Post()
  create(@Param('orgId') orgId: string, @Body() dto: CreateRenterDto) {
    return this.rentersService.create(orgId, dto);
  }

  @Get()
  findAll(@Param('orgId') orgId: string) {
    return this.rentersService.findAll(orgId);
  }

  @Get(':renterId')
  findOne(@Param('orgId') orgId: string, @Param('renterId') renterId: string) {
    return this.rentersService.findOne(orgId, renterId);
  }

  @Patch(':renterId')
  update(
    @Param('orgId') orgId: string,
    @Param('renterId') renterId: string,
    @Body() dto: UpdateRenterDto,
  ) {
    return this.rentersService.update(orgId, renterId, dto);
  }

  @Delete(':renterId')
  remove(@Param('orgId') orgId: string, @Param('renterId') renterId: string) {
    return this.rentersService.remove(orgId, renterId);
  }
}
