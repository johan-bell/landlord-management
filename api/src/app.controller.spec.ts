import { Test, TestingModule } from '@nestjs/testing';
import { AppController } from './app.controller';
import { AppService } from './app.service';
import { PrismaService } from './prisma/prisma.service';

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
                        $queryRaw: jest.fn().mockResolvedValue([{ '?column?': 1 }]),
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
