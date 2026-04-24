import { NotFoundException } from '@nestjs/common';
import { Test, TestingModule } from '@nestjs/testing';
import { PrismaService } from '../prisma/prisma.service';
import { PlatformService } from './platform.service';

describe('PlatformService', () => {
    let service: PlatformService;
    let prisma: {
        organization: {
            findMany: jest.Mock;
            findUnique: jest.Mock;
            update: jest.Mock;
        };
    };

    beforeEach(async () => {
        prisma = {
            organization: {
                findMany: jest.fn(),
                findUnique: jest.fn(),
                update: jest.fn(),
            },
        };

        const module: TestingModule = await Test.createTestingModule({
            providers: [
                PlatformService,
                { provide: PrismaService, useValue: prisma },
            ],
        }).compile();

        service = module.get(PlatformService);
    });

    describe('listOrganizations', () => {
        it('strips platformInternalNotes from each row', async () => {
            prisma.organization.findMany.mockResolvedValue([
                {
                    id: '1',
                    name: 'A',
                    platformInternalNotes: 'hidden',
                    _count: { members: 1, properties: 0, renters: 0 },
                },
            ]);

            const rows = await service.listOrganizations();

            expect(rows).toHaveLength(1);
            expect(rows[0]).not.toHaveProperty('platformInternalNotes');
            expect(rows[0]).toEqual(
                expect.objectContaining({
                    id: '1',
                    name: 'A',
                    _count: { members: 1, properties: 0, renters: 0 },
                }),
            );
        });
    });

    describe('setSuspended', () => {
        it('throws when organization missing', async () => {
            prisma.organization.findUnique.mockResolvedValue(null);
            await expect(service.setSuspended('x', true)).rejects.toThrow(
                NotFoundException,
            );
        });

        it('sets suspendedAt when suspending', async () => {
            prisma.organization.findUnique.mockResolvedValue({ id: 'o1' });
            prisma.organization.update.mockResolvedValue({
                id: 'o1',
                suspendedAt: new Date(),
            });

            await service.setSuspended('o1', true);

            expect(prisma.organization.update).toHaveBeenCalledTimes(1);
            const calls = prisma.organization.update.mock.calls as Array<
                [
                    {
                        where: { id: string };
                        data: { suspendedAt: Date | null };
                    },
                ]
            >;
            const updateArg = calls[0][0];
            expect(updateArg.where.id).toBe('o1');
            expect(updateArg.data.suspendedAt).toBeInstanceOf(Date);
        });
    });
});
