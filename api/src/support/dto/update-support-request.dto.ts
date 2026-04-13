import { IsEnum, IsOptional, IsString, MaxLength } from 'class-validator';
import { SupportRequestStatus } from '@prisma/client';

export class UpdateSupportRequestDto {
    @IsOptional()
    @IsEnum(SupportRequestStatus)
    status?: SupportRequestStatus;

    @IsOptional()
    @IsString()
    @MaxLength(8000)
    resolutionNote?: string;
}
