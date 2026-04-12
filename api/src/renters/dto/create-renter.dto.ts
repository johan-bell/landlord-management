import { IsEmail, IsOptional, IsString, MaxLength, MinLength } from 'class-validator';

export class CreateRenterDto {
  @IsString()
  @MinLength(1)
  @MaxLength(200)
  fullName!: string;

  @IsOptional()
  @IsString()
  @MaxLength(40)
  phone?: string;

  @IsOptional()
  @IsEmail()
  @MaxLength(200)
  email?: string;

  @IsOptional()
  @IsString()
  @MaxLength(120)
  idDocument?: string;

  @IsOptional()
  @IsString()
  @MaxLength(2000)
  notes?: string;
}
