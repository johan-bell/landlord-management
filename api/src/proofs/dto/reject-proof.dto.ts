import { IsOptional, IsString, MaxLength } from 'class-validator';

export class RejectProofDto {
    @IsOptional()
    @IsString()
    @MaxLength(2000)
    note?: string;
}
