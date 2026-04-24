import { ConfigService } from '@nestjs/config';
import { ObjectStorageService } from './object-storage.service';

function configWithS3(
    partial: Record<string, string | undefined>,
): ConfigService {
    return {
        get: (key: string) => partial[key],
    } as unknown as ConfigService;
}

describe('ObjectStorageService', () => {
    describe('isConfigured', () => {
        it('is false when any required key missing', () => {
            const svc = new ObjectStorageService(
                configWithS3({
                    S3_ENDPOINT: 'http://minio:9000',
                    S3_ACCESS_KEY: 'k',
                    // S3_SECRET_KEY missing
                    S3_BUCKET: 'b',
                }),
            );
            expect(svc.isConfigured()).toBe(false);
        });

        it('is true when all keys present', () => {
            const svc = new ObjectStorageService(
                configWithS3({
                    S3_ENDPOINT: 'http://minio:9000',
                    S3_ACCESS_KEY: 'k',
                    S3_SECRET_KEY: 's',
                    S3_BUCKET: 'b',
                }),
            );
            expect(svc.isConfigured()).toBe(true);
        });
    });
});
