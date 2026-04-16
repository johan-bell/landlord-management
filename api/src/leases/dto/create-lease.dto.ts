import { Type } from 'class-transformer';
import {
    IsDateString,
    IsInt,
    IsNumber,
    IsOptional,
    IsString,
    Max,
    Min,
} from 'class-validator';

export class CreateLeaseDto {
    @IsString()
    unitId!: string;

    @IsString()
    renterId!: string;

    @IsDateString()
    startDate!: string;

    @IsOptional()
    @IsDateString()
    endDate?: string;

    /** Defaults to the unit’s configured rent when omitted. */
    @IsOptional()
    @Type(() => Number)
    @IsNumber()
    rentAmount?: number;

    /** Defaults to the unit’s currency when omitted. */
    @IsOptional()
    @IsString()
    currency?: string;

    @IsOptional()
    @Type(() => Number)
    @IsInt()
    @Min(1)
    @Max(28)
    dueDay?: number;

    /** Number of consecutive months (from first due on/after start) recorded as already paid. */
    @IsOptional()
    @Type(() => Number)
    @IsInt()
    @Min(0)
    @Max(60)
    prepaidMonths?: number;
}
