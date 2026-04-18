import { IsOptional, IsString, MaxLength } from 'class-validator';

export class UpdatePlatformOrgNotesDto {
    @IsOptional()
    @IsString()
    @MaxLength(32_000)
    notes?: string;
}
