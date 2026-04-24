import { parsePagination, toPaginated } from './pagination-query.dto';

describe('parsePagination', () => {
    it('uses defaults when query undefined', () => {
        expect(parsePagination(undefined)).toEqual({
            page: 1,
            limit: 20,
            skip: 0,
        });
    });

    it('computes skip from page and limit', () => {
        expect(parsePagination({ page: 3, limit: 10 })).toEqual({
            page: 3,
            limit: 10,
            skip: 20,
        });
    });

    it('clamps limit to 500', () => {
        expect(parsePagination({ limit: 9999 })).toEqual({
            page: 1,
            limit: 500,
            skip: 0,
        });
    });

    it('clamps limit minimum to 1', () => {
        expect(parsePagination({ limit: 0 })).toEqual({
            page: 1,
            limit: 1,
            skip: 0,
        });
    });
});

describe('toPaginated', () => {
    it('computes totalPages', () => {
        expect(toPaginated(['a', 'b'], 25, 2, 10)).toEqual({
            items: ['a', 'b'],
            total: 25,
            page: 2,
            limit: 10,
            totalPages: 3,
        });
    });

    it('totalPages is 0 when total is 0', () => {
        expect(toPaginated([], 0, 1, 20)).toEqual({
            items: [],
            total: 0,
            page: 1,
            limit: 20,
            totalPages: 0,
        });
    });
});
