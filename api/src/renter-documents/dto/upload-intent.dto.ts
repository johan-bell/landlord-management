import { IsIn, IsString, MaxLength } from 'class-validator';

const ALLOWED_TYPES = [
    'image/jpeg',
    'image/png',
    'image/webp',
    'application/pdf',
] as const;

export class DocumentUploadIntentDto {
    @IsString()
    @MaxLength(200)
    label!: string;

    @IsIn(ALLOWED_TYPES)
    contentType!: string;
}
