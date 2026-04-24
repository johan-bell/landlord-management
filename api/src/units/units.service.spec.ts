import { NotFoundException } from '@nestjs/common';
import { Test, TestingModule } from '@nestjs/testing';
import { PrismaService } from '../prisma/prisma.service';
import { PropertiesService } from '../properties/properties.service';
import { UnitsService } from './units.service';

describe('UnitsService', () => {
    let service: UnitsService;
    let prisma: {
        unit: {
            count: jest.Mock;
            findMany: jest.Mock;
            findFirst: jest.Mock;
            create: jest.Mock;
            update: jest.Mock;
        };
    };
    let propertiesService: { findOne: jest.Mock };

    beforeEach(async () => {
        prisma = {
            unit: {
                count: jest.fn(),
                findMany: jest.fn(),
                findFirst: jest.fn(),
                create: jest.fn(),
                update: jest.fn(),
            },
        };
        propertiesService = {
            findOne: jest.fn().mockResolvedValue({ id: 'prop1' }),
        };

        const module: TestingModule = await Test.createTestingModule({
            providers: [
                UnitsService,
                { provide: PrismaService, useValue: prisma },
                { provide: PropertiesService, useValue: propertiesService },
            ],
        }).compile();

        service = module.get(UnitsService);
    });

    describe('findOne', () => {
        it('throws when unit missing', async () => {
            prisma.unit.findFirst.mockResolvedValue(null);
            await expect(service.findOne('o1', 'prop1', 'u1')).rejects.toThrow(
                NotFoundException,
            );
        });
    });

    describe('findAll', () => {
        it('returns paginated units for property', async () => {
            prisma.unit.count.mockResolvedValue(2);
            prisma.unit.findMany.mockResolvedValue([
                { id: 'u1' },
                { id: 'u2' },
            ]);

            const result = await service.findAll('o1', 'prop1');

            expect(propertiesService.findOne).toHaveBeenCalledWith(
                'o1',
                'prop1',
            );
            expect(result.total).toBe(2);
            expect(result.items).toHaveLength(2);
        });
    });
});
