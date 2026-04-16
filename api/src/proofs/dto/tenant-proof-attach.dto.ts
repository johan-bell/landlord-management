import { IsEnum, IsOptional, IsString, Matches, MaxLength, MinLength } from 'class-validator';

export enum TenantProofTarget {
    RENT = 'RENT',
    UTILITY = 'UTILITY',
}

export class TenantProofAttachDto {
    @IsEnum(TenantProofTarget)
    target!: TenantProofTarget;

    @IsString()
    @MinLength(1)
    @MaxLength(64)
    organizationId!: string;

    @IsString()
    @MinLength(1)
    @MaxLength(64)
    leaseId!: string;

    @IsString()
    @MinLength(1)
    @MaxLength(512)
    objectKey!: string;

    @IsString()
    @MinLength(8)
    @MaxLength(120)
    @Matches(/^image\/(jpeg|jpg|png|webp)$/i)
    contentType!: string;

    @IsOptional()
    @IsString()
    @MaxLength(64)
    paymentId?: string;

    @IsOptional()
    @IsString()
    @MaxLength(64)
    utilityBillId?: string;
}
