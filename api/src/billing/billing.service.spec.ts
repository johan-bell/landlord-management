import { BadRequestException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { Test, TestingModule } from '@nestjs/testing';
import { PrismaService } from '../prisma/prisma.service';
import { BillingService } from './billing.service';

describe('BillingService', () => {
    describe('without Stripe keys', () => {
        let service: BillingService;

        beforeEach(async () => {
            const config = {
                get: jest.fn().mockReturnValue(undefined),
            } as unknown as ConfigService;
            const prisma = {} as unknown as PrismaService;

            const module: TestingModule = await Test.createTestingModule({
                providers: [
                    {
                        provide: BillingService,
                        useFactory: () => new BillingService(config, prisma),
                    },
                ],
            }).compile();

            service = module.get(BillingService);
        });

        it('isEnabled is false', () => {
            expect(service.isEnabled()).toBe(false);
        });

        it('createCheckoutSession throws BadRequestException', async () => {
            await expect(
                service.createCheckoutSession(
                    'org',
                    'https://ok',
                    'https://cancel',
                ),
            ).rejects.toThrow(BadRequestException);
        });
    });
});
