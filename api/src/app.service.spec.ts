import { Test, TestingModule } from '@nestjs/testing';
import { AppService } from './app.service';
import { EmailService } from './email/email.service';
import { PrismaService } from './prisma/prisma.service';
import { ObjectStorageService } from './storage/object-storage.service';

describe('AppService', () => {
    let service: AppService;
    let prisma: { $queryRaw: jest.Mock };
    let storage: { isConfigured: jest.Mock };
    let email: { isConfigured: jest.Mock };

    beforeEach(async () => {
        prisma = {
            $queryRaw: jest.fn().mockResolvedValue([{ '?column?': 1 }]),
        };
        storage = { isConfigured: jest.fn().mockReturnValue(false) };
        email = { isConfigured: jest.fn().mockReturnValue(false) };

        const module: TestingModule = await Test.createTestingModule({
            providers: [
                AppService,
                { provide: PrismaService, useValue: prisma },
                { provide: ObjectStorageService, useValue: storage },
                { provide: EmailService, useValue: email },
            ],
        }).compile();

        service = module.get(AppService);
    });

    describe('getHealth', () => {
        it('returns ok when database query succeeds', async () => {
            const result = await service.getHealth();
            expect(result.ok).toBe(true);
            expect(result.database).toBe('ok');
            expect(result.service).toBe('landlord-management-api');
            expect(result.version).toBe('0.1.0');
            expect(result.storage).toBe('disabled');
            expect(result.email).toBe('disabled');
            expect(result.time).toMatch(/^\d{4}-\d{2}-\d{2}T/);
        });

        it('marks database error when query fails', async () => {
            prisma.$queryRaw.mockRejectedValueOnce(new Error('db down'));
            const result = await service.getHealth();
            expect(result.ok).toBe(false);
            expect(result.database).toBe('error');
        });

        it('reflects configured storage and email', async () => {
            storage.isConfigured.mockReturnValue(true);
            email.isConfigured.mockReturnValue(true);
            const result = await service.getHealth();
            expect(result.storage).toBe('configured');
            expect(result.email).toBe('configured');
        });
    });
});
