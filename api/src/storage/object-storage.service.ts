import {
    Injectable,
    Logger,
    OnModuleInit,
    ServiceUnavailableException,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { randomUUID } from 'crypto';
import { Client as MinioClient } from 'minio';

const RECEIPT_PREFIX = 'receipts';
const DOCUMENT_PREFIX = 'documents';
const SUPPORT_PHOTO_PREFIX = 'support-photos';

function parseMinioEndpoint(raw: string): {
    endPoint: string;
    port: number;
    useSSL: boolean;
} {
    const url = new URL(raw.includes('://') ? raw : `http://${raw}`);
    const port = url.port
        ? parseInt(url.port, 10)
        : url.protocol === 'https:'
          ? 443
          : 80;
    return {
        endPoint: url.hostname,
        port,
        useSSL: url.protocol === 'https:',
    };
}

@Injectable()
export class ObjectStorageService implements OnModuleInit {
    private readonly logger = new Logger(ObjectStorageService.name);
    private client: MinioClient | null = null;
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
                'MinIO not configured (S3_ENDPOINT, S3_ACCESS_KEY, S3_SECRET_KEY, S3_BUCKET). Receipt uploads are disabled.',
            );
            return;
        }
        const endpointRaw = this.config.get<string>('S3_ENDPOINT')!;
        const pathStyle =
            (this.config.get<string>('S3_FORCE_PATH_STYLE') ?? 'true') ===
            'true';
        const { endPoint, port, useSSL } = parseMinioEndpoint(endpointRaw);
        const bucket = this.config.get<string>('S3_BUCKET')!;
        try {
            const client = new MinioClient({
                endPoint,
                port,
                useSSL,
                pathStyle,
                accessKey: this.config.get<string>('S3_ACCESS_KEY')!,
                secretKey: this.config.get<string>('S3_SECRET_KEY')!,
                region: this.region,
            });
            await this.ensureBucket(client, bucket);
            this.client = client;
            this.bucket = bucket;
        } catch (err) {
            this.client = null;
            this.bucket = null;
            const msg = err instanceof Error ? err.message : String(err);
            const hint =
                msg.includes('ENOTFOUND') || msg.includes('getaddrinfo')
                    ? ` Host "${endPoint}" does not resolve (check S3_ENDPOINT). For local MinIO use e.g. http://127.0.0.1:9000 or http://localhost:9000, or add the hostname to /etc/hosts.`
                    : '';
            this.logger.error(
                `MinIO unavailable; receipt uploads disabled. ${msg}.${hint}`,
            );
        }
    }

    private async ensureBucket(
        client: MinioClient,
        bucket: string,
    ): Promise<void> {
        const exists = await client.bucketExists(bucket);
        if (!exists) {
            this.logger.log(`Creating MinIO bucket ${bucket}`);
            await client.makeBucket(bucket, this.region);
        }
        this.logger.log(
            `MinIO bucket ready: ${bucket}. For browser uploads, ensure the server allows your origins (e.g. MINIO_API_CORS_ALLOW_ORIGIN in docker-compose).`,
        );
    }

    assertEnabled(): void {
        if (!this.client || !this.bucket) {
            throw new ServiceUnavailableException(
                'File storage is not available. Set MinIO variables (S3_ENDPOINT, S3_ACCESS_KEY, S3_SECRET_KEY, S3_BUCKET) and ensure the endpoint host resolves (e.g. http://localhost:9000).',
            );
        }
    }

    async ping(): Promise<void> {
        if (!this.client || !this.bucket) {
            throw new Error('MinIO not configured');
        }
        await this.client.bucketExists(this.bucket);
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

    buildDocumentObjectKey(orgId: string, renterId: string, contentType: string): string {
        const ext = this.extFromMime(contentType);
        return `org/${orgId}/${DOCUMENT_PREFIX}/${renterId}/${randomUUID()}${ext}`;
    }

    documentKeyBelongsToOrg(orgId: string, objectKey: string): boolean {
        return objectKey.startsWith(`org/${orgId}/${DOCUMENT_PREFIX}/`);
    }

    buildSupportPhotoObjectKey(orgId: string, contentType: string): string {
        const ext = this.extFromMime(contentType);
        return `org/${orgId}/${SUPPORT_PHOTO_PREFIX}/${randomUUID()}${ext}`;
    }

    supportPhotoKeyBelongsToOrg(orgId: string, objectKey: string): boolean {
        return objectKey.startsWith(`org/${orgId}/${SUPPORT_PHOTO_PREFIX}/`);
    }

    private extFromMime(contentType: string): string {
        if (contentType === 'image/png') return '.png';
        if (contentType === 'image/webp') return '.webp';
        if (contentType === 'image/jpeg' || contentType === 'image/jpg') return '.jpg';
        if (contentType === 'application/pdf') return '.pdf';
        return '';
    }

    /**
     * Presigned PUT for tenant browser uploads. MinIO signs without binding
     * Content-Type so the client can send the same type as declared to the API.
     */
    async getPresignedPutUrl(
        objectKey: string,
        contentType: string,
    ): Promise<string> {
        void contentType;
        this.assertEnabled();
        return this.client!.presignedPutObject(
            this.bucket!,
            objectKey,
            this.uploadUrlExpiresSec,
        );
    }

    async getPresignedGetUrl(objectKey: string): Promise<string> {
        this.assertEnabled();
        return this.client!.presignedGetObject(
            this.bucket!,
            objectKey,
            this.viewUrlExpiresSec,
        );
    }
}
