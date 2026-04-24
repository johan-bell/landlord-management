import { NotFoundException } from '@nestjs/common';
import { Test, TestingModule } from '@nestjs/testing';
import { OrganizationsService } from '../organizations/organizations.service';
import { PrismaService } from '../prisma/prisma.service';
import { PropertiesService } from './properties.service';

describe('PropertiesService', () => {
    let service: PropertiesService;
    let prisma: {
        property: {
            create: jest.Mock;
            count: jest.Mock;
            findMany: jest.Mock;
            findFirst: jest.Mock;
            update: jest.Mock;
        };
    };
    let organizationsService: { findOneOrThrow: jest.Mock };

    beforeEach(async () => {
        prisma = {
            property: {
                create: jest.fn(),
                count: jest.fn(),
                findMany: jest.fn(),
                findFirst: jest.fn(),
                update: jest.fn(),
            },
        };
        organizationsService = {
            findOneOrThrow: jest.fn().mockResolvedValue({}),
        };

        const module: TestingModule = await Test.createTestingModule({
            providers: [
                PropertiesService,
                { provide: PrismaService, useValue: prisma },
                {
                    provide: OrganizationsService,
                    useValue: organizationsService,
                },
            ],
        }).compile();

        service = module.get(PropertiesService);
    });

    describe('create', () => {
        it('creates property after org check', async () => {
            const created = {
                id: 'p1',
                organizationId: 'o1',
                name: 'HQ',
                address: '1 St',
            };
            prisma.property.create.mockResolvedValue(created);

            const result = await service.create('o1', {
                name: 'HQ',
                address: '1 St',
            });

            expect(organizationsService.findOneOrThrow).toHaveBeenCalledWith(
                'o1',
            );
            expect(prisma.property.create).toHaveBeenCalledWith({
                data: {
                    organizationId: 'o1',
                    name: 'HQ',
                    address: '1 St',
                },
            });
            expect(result).toEqual(created);
        });
    });

    describe('findAll', () => {
        it('returns paginated properties', async () => {
            prisma.property.count.mockResolvedValue(1);
            prisma.property.findMany.mockResolvedValue([{ id: 'p1' }]);

            const result = await service.findAll('o1', {
                page: 1,
                limit: 20,
            });

            expect(result.items).toEqual([{ id: 'p1' }]);
            expect(result.total).toBe(1);
            expect(result.page).toBe(1);
            expect(result.limit).toBe(20);
            expect(result.totalPages).toBe(1);
        });
    });

    describe('findOne', () => {
        it('throws when property missing', async () => {
            prisma.property.findFirst.mockResolvedValue(null);
            await expect(service.findOne('o1', 'missing')).rejects.toThrow(
                NotFoundException,
            );
        });

        it('returns property when found', async () => {
            const row = { id: 'p1', organizationId: 'o1', name: 'X' };
            prisma.property.findFirst.mockResolvedValue(row);
            await expect(service.findOne('o1', 'p1')).resolves.toEqual(row);
        });
    });

    describe('remove', () => {
        it('soft-deletes by setting deletedAt', async () => {
            prisma.property.findFirst.mockResolvedValue({ id: 'p1' });
            const updated = { id: 'p1', deletedAt: new Date() };
            prisma.property.update.mockResolvedValue(updated);

            const result = await service.remove('o1', 'p1');

            expect(prisma.property.update).toHaveBeenCalledTimes(1);
            const calls = prisma.property.update.mock.calls as Array<
                [
                    {
                        where: { id: string };
                        data: { deletedAt: Date };
                    },
                ]
            >;
            const updateArg = calls[0][0];
            expect(updateArg.where.id).toBe('p1');
            expect(updateArg.data.deletedAt).toBeInstanceOf(Date);
            expect(result).toEqual(updated);
        });
    });
});
