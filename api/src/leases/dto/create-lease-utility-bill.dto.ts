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

    /** Manual total when not using meter readings. */
    @IsOptional()
    @Type(() => Number)
    @IsNumber()
    @Min(0)
    amount?: number;

    /**
     * New meter reading (m³ or kWh). Amount = (current − previous) × unit price.
     * Omit `amount` when using this.
     */
    @IsOptional()
    @Type(() => Number)
    @IsNumber()
    @Min(0)
    currentMeterIndex?: number;

    /** Required for the first period if there is no prior bill with a current index. */
    @IsOptional()
    @Type(() => Number)
    @IsNumber()
    @Min(0)
    previousMeterIndex?: number;

    @IsDateString()
    dueDate!: string;

    @IsOptional()
    @IsString()
    @MaxLength(10)
    currency?: string;
}
