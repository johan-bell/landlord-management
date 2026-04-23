export class PaginatedResponse<T> {
    readonly items: T[];
    readonly total: number;
    readonly page: number;
    readonly limit: number;
    readonly totalPages: number;

    constructor(items: T[], total: number, page: number, limit: number) {
        this.items = items;
        this.total = total;
        this.page = page;
        this.limit = limit;
        this.totalPages = limit > 0 ? Math.ceil(total / limit) : 0;
    }
}
