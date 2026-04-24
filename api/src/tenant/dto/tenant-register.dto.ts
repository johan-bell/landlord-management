import {
    IsEmail,
    IsOptional,
    IsString,
    MaxLength,
    MinLength,
} from 'class-validator';

export class TenantRegisterDto {
    @IsEmail()
    email!: string;

    @IsString()
    @MinLength(8)
    @MaxLength(128)
    password!: string;

    @IsString()
    @MinLength(1)
    @MaxLength(40)
    organizationId!: string;

    @IsString()
    @MinLength(2)
    @MaxLength(120)
    fullName!: string;

    @IsOptional()
    @IsString()
    @MaxLength(40)
    phone?: string;
}
