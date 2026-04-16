import {
    CreateBucketCommand,
    GetObjectCommand,
    HeadBucketCommand,
    PutBucketCorsCommand,
    PutObjectCommand,
    S3Client,
} from '@aws-sdk/client-s3';
import { getSignedUrl } from '@aws-sdk/s3-request-presigner';
import { Injectable, Logger, OnModuleInit, ServiceUnavailableException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { randomUUID } from 'crypto';

const RECEIPT_PREFIX = 'receipts';

@Injectable()
export class ObjectStorageService implements OnModuleInit {
    private readonly logger = new Logger(ObjectStorageService.name);
    private client: S3Client | null = null;
    private bucket: string | null = null;
    private readonly region: string;
    private readonly uploadUrlExpiresSec = 900;
    private readonly viewUrlExpiresSec = 600;

    constructor(private readonly config: ConfigService) {
        this.region = this.config.get<string>('S3_REGION') ?? 'us-east-1';
    }

    isConfigured(): boolean {
        return Boolean(
            this.config.get<string>('S3_ENDPOINT') &&
                this.config.get<string>('S3_ACCESS_KEY') &&
                this.config.get<string>('S3_SECRET_KEY') &&
                this.config.get<string>('S3_BUCKET'),
        );
    }

    async onModuleInit(): Promise<void> {
        if (!this.isConfigured()) {
            this.logger.warn(
                'S3/MinIO not configured (S3_ENDPOINT, S3_ACCESS_KEY, S3_SECRET_KEY, S3_BUCKET). Receipt uploads are disabled.',
            );
            return;
        }
        const endpoint = this.config.get<string>('S3_ENDPOINT')!;
        const forcePathStyle =
            (this.config.get<string>('S3_FORCE_PATH_STYLE') ?? 'true') ===
            'true';
        this.bucket = this.config.get<string>('S3_BUCKET')!;
        this.client = new S3Client({
            region: this.region,
            endpoint,
            forcePathStyle,
            credentials: {
                accessKeyId: this.config.get<string>('S3_ACCESS_KEY')!,
                secretAccessKey: this.config.get<string>('S3_SECRET_KEY')!,
            },
        });
        await this.ensureBucketAndCors();
    }

    private async ensureBucketAndCors(): Promise<void> {
        if (!this.client || !this.bucket) return;
        try {
            await this.client.send(
                new HeadBucketCommand({ Bucket: this.bucket }),
            );
        } catch {
            this.logger.log(`Creating bucket ${this.bucket}`);
            await this.client.send(
                new CreateBucketCommand({ Bucket: this.bucket }),
            );
        }
        const corsOrigins = this.parseCorsOrigins();
        await this.client.send(
            new PutBucketCorsCommand({
                Bucket: this.bucket,
                CORSConfiguration: {
                    CORSRules: [
                        {
                            AllowedHeaders: ['*'],
                            AllowedMethods: ['GET', 'PUT', 'HEAD'],
                            AllowedOrigins: corsOrigins,
                            ExposeHeaders: ['ETag'],
                            MaxAgeSeconds: 3600,
                        },
                    ],
                },
            }),
        );
    }

    private parseCorsOrigins(): string[] {
        const raw = this.config.get<string>('CORS_ORIGIN');
        if (!raw?.trim()) return ['*'];
        try {
            const parsed = JSON.parse(raw) as unknown;
            if (Array.isArray(parsed) && parsed.every((x) => typeof x === 'string')) {
                return parsed as string[];
            }
        } catch {
            /* single origin string */
        }
        if (raw.includes(',')) {
            return raw.split(',').map((s) => s.trim());
        }
        return [raw.trim()];
    }

    assertEnabled(): void {
        if (!this.client || !this.bucket) {
            throw new ServiceUnavailableException(
                'File storage is not configured. Set S3_* environment variables (e.g. MinIO).',
            );
        }
    }

    buildReceiptObjectKey(orgId: string, contentType: string): string {
        const ext =
            contentType === 'image/png'
                ? '.png'
                : contentType === 'image/webp'
                  ? '.webp'
                  : contentType === 'image/jpeg' || contentType === 'image/jpg'
                    ? '.jpg'
                    : '';
        const suffix = ext || '';
        return `org/${orgId}/${RECEIPT_PREFIX}/${randomUUID()}${suffix}`;
    }

    keyBelongsToOrg(orgId: string, objectKey: string): boolean {
        return objectKey.startsWith(`org/${orgId}/${RECEIPT_PREFIX}/`);
    }

    async getPresignedPutUrl(
        objectKey: string,
        contentType: string,
    ): Promise<string> {
        this.assertEnabled();
        const cmd = new PutObjectCommand({
            Bucket: this.bucket!,
            Key: objectKey,
            ContentType: contentType,
        });
        return getSignedUrl(this.client!, cmd, {
            expiresIn: this.uploadUrlExpiresSec,
        });
    }

    async getPresignedGetUrl(objectKey: string): Promise<string> {
        this.assertEnabled();
        const cmd = new GetObjectCommand({
            Bucket: this.bucket!,
            Key: objectKey,
        });
        return getSignedUrl(this.client!, cmd, {
            expiresIn: this.viewUrlExpiresSec,
        });
    }
}
