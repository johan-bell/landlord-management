import { IsEmail, IsString, MaxLength, MinLength } from 'class-validator';

/** Claim a renter profile: must match renter email and renterId from landlord invite. */
export class TenantRegisterDto {
  @IsString()
  @MinLength(10)
  @MaxLength(40)
  renterId!: string;

  @IsEmail()
  email!: string;

  @IsString()
  @MinLength(8)
  @MaxLength(128)
  password!: string;
}
