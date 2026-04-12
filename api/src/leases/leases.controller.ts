import { Body, Controller, Delete, Get, Param, Patch, Post, UseGuards } from '@nestjs/common';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { OrgMembershipGuard } from '../auth/guards/org-membership.guard';
import { CreateLeaseDto } from './dto/create-lease.dto';
import { UpdateLeaseDto } from './dto/update-lease.dto';
import { LeasesService } from './leases.service';

@Controller('organizations/:orgId/leases')
@UseGuards(JwtAuthGuard, OrgMembershipGuard)
export class LeasesController {
  constructor(private readonly leasesService: LeasesService) {}

  @Post()
  create(@Param('orgId') orgId: string, @Body() dto: CreateLeaseDto) {
    return this.leasesService.create(orgId, dto);
  }

  @Get()
  findAll(@Param('orgId') orgId: string) {
    return this.leasesService.findAll(orgId);
  }

  @Get(':leaseId')
  findOne(@Param('orgId') orgId: string, @Param('leaseId') leaseId: string) {
    return this.leasesService.findOne(orgId, leaseId);
  }

  @Patch(':leaseId')
  update(
    @Param('orgId') orgId: string,
    @Param('leaseId') leaseId: string,
    @Body() dto: UpdateLeaseDto,
  ) {
    return this.leasesService.update(orgId, leaseId, dto);
  }

  @Delete(':leaseId')
  remove(@Param('orgId') orgId: string, @Param('leaseId') leaseId: string) {
    return this.leasesService.remove(orgId, leaseId);
  }
}
