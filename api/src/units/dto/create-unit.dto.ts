import { ElectricityBilling, WaterBilling } from '@prisma/client';
import { Type } from 'class-transformer';
import {
    IsEnum,
    IsNumber,
    IsOptional,
    IsString,
    MaxLength,
    Min,
    MinLength,
} from 'class-validator';

export class CreateUnitDto {
    @IsString()
    @MinLength(1)
    @MaxLength(100)
    label!: string;

    @Type(() => Number)
    @IsNumber()
    rentAmount!: number;

    @IsOptional()
    @IsString()
    @MaxLength(10)
    currency?: string;

    @IsOptional()
    @IsEnum(ElectricityBilling)
    electricityBilling?: ElectricityBilling;

    @IsOptional()
    @Type(() => Number)
    @IsNumber()
    @Min(0)
    electricityPricePerKwh?: number | null;

    @IsOptional()
    @IsEnum(WaterBilling)
    waterBilling?: WaterBilling;

    @IsOptional()
    @Type(() => Number)
    @IsNumber()
    @Min(0)
    waterPricePerM3?: number | null;
}
