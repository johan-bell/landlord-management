import { Injectable } from '@nestjs/common';
import { HealthIndicator, HealthIndicatorResult } from '@nestjs/terminus';
import { EmailService } from '../email/email.service';
import { ObjectStorageService } from '../storage/object-storage.service';

@Injectable()
export class HealthService extends HealthIndicator {
    constructor(
        private readonly email: EmailService,
        private readonly storage: ObjectStorageService,
    ) {
        super();
    }

    async checkSmtp(): Promise<HealthIndicatorResult> {
        if (!this.email.isConfigured()) {
            return this.getStatus('smtp', true, { status: 'disabled' });
        }
        try {
            await this.email.verifySmtp();
            return this.getStatus('smtp', true);
        } catch (err) {
            return this.getStatus('smtp', false, {
                message: err instanceof Error ? err.message : 'SMTP verify failed',
            });
        }
    }

    async checkMinio(): Promise<HealthIndicatorResult> {
        if (!this.storage.isConfigured()) {
            return this.getStatus('minio', true, { status: 'disabled' });
        }
        try {
            await this.storage.ping();
            return this.getStatus('minio', true);
        } catch (err) {
            return this.getStatus('minio', false, {
                message: err instanceof Error ? err.message : 'MinIO ping failed',
            });
        }
    }
}
