import {
  IsEmail,
  IsOptional,
  IsString,
  MaxLength,
  MinLength,
} from 'class-validator';

/**
 * Three modes (exactly one):
 * - **Organization request:** `organizationId` and/or `organizationSlug` + `fullName` — pending admin approval.
 * - **Invite token:** `inviteToken` (from landlord link).
 * - **Claim existing renter:** `renterId` (must match profile email).
 */
export class TenantRegisterDto {
  @IsEmail()
  email!: string;

  @IsString()
  @MinLength(8)
  @MaxLength(128)
  password!: string;

  @IsOptional()
  @IsString()
  @MaxLength(40)
  renterId?: string;

  @IsOptional()
  @IsString()
  @MaxLength(128)
  inviteToken?: string;

  @IsOptional()
  @IsString()
  @MaxLength(40)
  organizationId?: string;

  @IsOptional()
  @IsString()
  @MaxLength(80)
  organizationSlug?: string;

  @IsOptional()
  @IsString()
  @MinLength(2)
  @MaxLength(120)
  fullName?: string;

  @IsOptional()
  @IsString()
  @MaxLength(40)
  phone?: string;
}
