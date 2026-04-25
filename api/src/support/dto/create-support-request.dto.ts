import { SupportCategory, SupportUrgency } from '@prisma/client';
import {
    IsEnum,
    IsOptional,
    IsString,
    MaxLength,
    MinLength,
} from 'class-validator';

export class CreateSupportRequestDto {
    @IsString()
    @MinLength(1)
    @MaxLength(200)
    subject!: string;

    @IsString()
    @MinLength(1)
    @MaxLength(8000)
    message!: string;

    @IsOptional()
    @IsEnum(SupportCategory)
    category?: SupportCategory;

    @IsOptional()
    @IsEnum(SupportUrgency)
    urgency?: SupportUrgency;

    /** Required when submitting as a tenant (scoped to an organization you belong to). Uses cuid, not UUID. */
    @IsOptional()
    @IsString()
    @MinLength(1)
    @MaxLength(64)
    organizationId?: string;
}
