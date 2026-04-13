import { UtilityKind } from '@prisma/client';
import { Type } from 'class-transformer';
import {
  IsDateString,
  IsEnum,
  IsInt,
  IsNumber,
  IsOptional,
  IsString,
  Max,
  MaxLength,
  Min,
} from 'class-validator';

export class CreateLeaseUtilityBillDto {
  @IsEnum(UtilityKind)
  kind!: UtilityKind;

  @Type(() => Number)
  @IsInt()
  @Min(2000)
  @Max(2100)
  year!: number;

  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(12)
  month!: number;

  @Type(() => Number)
  @IsNumber()
  @Min(0)
  amount!: number;

  @IsDateString()
  dueDate!: string;

  @IsOptional()
  @IsString()
  @MaxLength(10)
  currency?: string;
}
