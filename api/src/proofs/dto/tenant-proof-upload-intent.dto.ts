import { IsString, Matches, MaxLength, MinLength } from 'class-validator';

export class TenantProofUploadIntentDto {
    @IsString()
    @MinLength(1)
    @MaxLength(64)
    organizationId!: string;

    @IsString()
    @MinLength(8)
    @MaxLength(120)
    @Matches(/^image\/(jpeg|jpg|png|webp)$/i, {
        message: 'Use image/jpeg, image/png, or image/webp',
    })
    contentType!: string;
}
