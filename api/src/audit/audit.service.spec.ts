import { Test, TestingModule } from '@nestjs/testing';
import { PrismaService } from '../prisma/prisma.service';
import { AuditService } from './audit.service';

describe('AuditService', () => {
    let service: AuditService;
    let prisma: {
        auditLog: { create: jest.Mock; findMany: jest.Mock; count: jest.Mock };
    };

    beforeEach(async () => {
        prisma = {
            auditLog: {
                create: jest.fn().mockResolvedValue({}),
                findMany: jest.fn().mockResolvedValue([]),
                count: jest.fn().mockResolvedValue(0),
            },
        };

        const module: TestingModule = await Test.createTestingModule({
            providers: [
                AuditService,
                { provide: PrismaService, useValue: prisma },
            ],
        }).compile();

        service = module.get(AuditService);
    });

    describe('record', () => {
        it('persists audit row', async () => {
            await service.record({
                organizationId: 'o1',
                actorUserId: 'u1',
                action: 'test.action',
                entityType: 'Property',
                entityId: 'p1',
                metadata: { a: 1 },
            });

            expect(prisma.auditLog.create).toHaveBeenCalledTimes(1);
            const calls = prisma.auditLog.create.mock.calls as Array<
                [
                    {
                        data: {
                            organizationId: string;
                            actorUserId: string;
                            action: string;
                            entityType: string;
                            entityId: string;
                            metadata?: Record<string, unknown>;
                        };
                    },
                ]
            >;
            const createArg = calls[0][0];
            expect(createArg.data).toMatchObject({
                organizationId: 'o1',
                actorUserId: 'u1',
                action: 'test.action',
                entityType: 'Property',
                entityId: 'p1',
            });
            expect(createArg.data.metadata).toMatchObject({ a: 1 });
        });
    });

    describe('listForOrg', () => {
        it('clamps limit and returns items with total', async () => {
            prisma.auditLog.findMany.mockResolvedValue([{ id: '1' }]);
            prisma.auditLog.count.mockResolvedValue(50);

            const result = await service.listForOrg('o1', 2, 500);

            expect(result.page).toBe(2);
            expect(result.limit).toBe(100);
            expect(result.items).toEqual([{ id: '1' }]);
            expect(result.total).toBe(50);
            expect(prisma.auditLog.findMany).toHaveBeenCalledWith(
                expect.objectContaining({
                    where: { organizationId: 'o1' },
                    skip: 100,
                    take: 100,
                }),
            );
        });
    });
});
