import { PaymentStatus } from '@prisma/client';
import { Type } from 'class-transformer';
import { IsDateString, IsEnum, IsOptional } from 'class-validator';

export class UpdateLeaseUtilityBillDto {
  @IsOptional()
  @IsEnum(PaymentStatus)
  status?: PaymentStatus;

  @IsOptional()
  @IsDateString()
  paidAt?: string | null;
}
