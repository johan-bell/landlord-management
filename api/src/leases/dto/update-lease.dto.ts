import { PartialType } from '@nestjs/mapped-types';
import { IsInt, IsOptional, Max, Min } from 'class-validator';
import { CreateLeaseDto } from './create-lease.dto';

export class UpdateLeaseDto extends PartialType(CreateLeaseDto) {
    @IsOptional()
    @IsInt()
    @Min(1)
    @Max(60)
    renewMonths?: number;
}
