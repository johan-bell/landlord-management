import { IsIn, IsString, MaxLength } from 'class-validator';

const ALLOWED_TYPES = [
    'image/jpeg',
    'image/png',
    'image/webp',
    'application/pdf',
] as const;

export class AttachDocumentDto {
    @IsString()
    @MaxLength(200)
    label!: string;

    @IsString()
    objectKey!: string;

    @IsIn(ALLOWED_TYPES)
    contentType!: string;
}
