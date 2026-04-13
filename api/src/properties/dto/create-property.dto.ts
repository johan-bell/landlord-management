import { IsOptional, IsString, MaxLength, MinLength } from 'class-validator';

export class CreatePropertyDto {
    @IsString()
    @MinLength(1)
    @MaxLength(200)
    name!: string;

    @IsOptional()
    @IsString()
    @MaxLength(500)
    address?: string;
}
