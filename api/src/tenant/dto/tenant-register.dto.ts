import { IsEmail, IsString, MaxLength, MinLength, ValidateIf } from 'class-validator';

/** Claim a renter profile with `renterId` **or** an `inviteToken` from the landlord invite link. */
export class TenantRegisterDto {
  @ValidateIf((o: TenantRegisterDto) => !o.inviteToken)
  @IsString()
  @MinLength(10)
  @MaxLength(40)
  renterId?: string;

  @ValidateIf((o: TenantRegisterDto) => !o.renterId)
  @IsString()
  @MinLength(24)
  @MaxLength(128)
  inviteToken?: string;

  @IsEmail()
  email!: string;

  @IsString()
  @MinLength(8)
  @MaxLength(128)
  password!: string;
}
