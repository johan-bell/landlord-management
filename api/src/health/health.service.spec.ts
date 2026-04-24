import { Test, TestingModule } from '@nestjs/testing';
import { EmailService } from '../email/email.service';
import { ObjectStorageService } from '../storage/object-storage.service';
import { HealthService } from './health.service';

describe('HealthService', () => {
    let service: HealthService;
    let email: { isConfigured: jest.Mock; verifySmtp: jest.Mock };
    let storage: { isConfigured: jest.Mock; ping: jest.Mock };

    beforeEach(async () => {
        email = {
            isConfigured: jest.fn(),
            verifySmtp: jest.fn(),
        };
        storage = {
            isConfigured: jest.fn(),
            ping: jest.fn(),
        };

        const module: TestingModule = await Test.createTestingModule({
            providers: [
                HealthService,
                { provide: EmailService, useValue: email },
                { provide: ObjectStorageService, useValue: storage },
            ],
        }).compile();

        service = module.get(HealthService);
    });

    describe('checkSmtp', () => {
        it('returns disabled detail when email not configured', async () => {
            email.isConfigured.mockReturnValue(false);
            const r = await service.checkSmtp();
            expect(r.smtp).toEqual(
                expect.objectContaining({ status: 'disabled' }),
            );
            expect(email.verifySmtp).not.toHaveBeenCalled();
        });

        it('returns up when verify succeeds', async () => {
            email.isConfigured.mockReturnValue(true);
            email.verifySmtp.mockResolvedValue(undefined);
            const r = await service.checkSmtp();
            expect(r.smtp.status).toBe('up');
        });

        it('returns down when verify throws', async () => {
            email.isConfigured.mockReturnValue(true);
            email.verifySmtp.mockRejectedValue(new Error('SMTP refused'));
            const r = await service.checkSmtp();
            expect(r.smtp.status).toBe('down');
            expect(r.smtp).toEqual(
                expect.objectContaining({
                    message: 'SMTP refused',
                }),
            );
        });
    });

    describe('checkMinio', () => {
        it('returns disabled detail when storage not configured', async () => {
            storage.isConfigured.mockReturnValue(false);
            const r = await service.checkMinio();
            expect(r.minio).toEqual(
                expect.objectContaining({ status: 'disabled' }),
            );
            expect(storage.ping).not.toHaveBeenCalled();
        });

        it('returns up when ping succeeds', async () => {
            storage.isConfigured.mockReturnValue(true);
            storage.ping.mockResolvedValue(undefined);
            const r = await service.checkMinio();
            expect(r.minio.status).toBe('up');
        });

        it('returns down when ping throws', async () => {
            storage.isConfigured.mockReturnValue(true);
            storage.ping.mockRejectedValue(new Error('timeout'));
            const r = await service.checkMinio();
            expect(r.minio.status).toBe('down');
            expect(r.minio).toEqual(
                expect.objectContaining({ message: 'timeout' }),
            );
        });
    });
});
