import { Test, TestingModule } from '@nestjs/testing';
import { AppController } from './app.controller';
import { AppService } from './app.service';
import { EmailService } from './email/email.service';
import { PrismaService } from './prisma/prisma.service';
import { ObjectStorageService } from './storage/object-storage.service';

describe('AppController', () => {
    let appController: AppController;

    beforeEach(async () => {
        const app: TestingModule = await Test.createTestingModule({
            controllers: [AppController],
            providers: [
                AppService,
                {
                    provide: PrismaService,
                    useValue: {
                        $queryRaw: jest
                            .fn()
                            .mockResolvedValue([{ '?column?': 1 }]),
                    },
                },
                {
                    provide: ObjectStorageService,
                    useValue: {
                        isConfigured: jest.fn().mockReturnValue(false),
                    },
                },
                {
                    provide: EmailService,
                    useValue: {
                        isConfigured: jest.fn().mockReturnValue(false),
                    },
                },
            ],
        }).compile();

        appController = app.get<AppController>(AppController);
    });

    describe('health', () => {
        it('should return health payload', async () => {
            await expect(appController.health()).resolves.toEqual(
                expect.objectContaining({
                    ok: true,
                    service: 'landlord-management-api',
                    database: 'ok',
                }),
            );
        });
    });
});
