import { Injectable, OnModuleDestroy, OnModuleInit } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { PrismaPg } from '@prisma/adapter-pg';
import { PrismaClient } from '@prisma/client';
import { Pool } from 'pg';

const SOFT_DELETE_MODELS = new Set(['Property', 'Unit', 'Renter']);

const FILTER_ACTIONS = new Set([
    'findFirst',
    'findFirstOrThrow',
    'findMany',
    'count',
    'aggregate',
    'groupBy',
]);

type SoftDeleteQueryParams = {
    model: string;
    operation: string;
    args: unknown;
    query: (args: unknown) => Promise<unknown>;
};

type PrismaClientWithLifecycle = PrismaClient & {
    onModuleInit: () => Promise<void>;
    onModuleDestroy: () => Promise<void>;
};

@Injectable()
export class PrismaService
    extends PrismaClient
    implements OnModuleInit, OnModuleDestroy
{
    private readonly pool: Pool;

    constructor(config: ConfigService) {
        const url = config.get<string>('DATABASE_URL')?.trim();
        if (!url) {
            throw new Error(
                'DATABASE_URL is missing. Create api/.env with DATABASE_URL (see api/.env.example) and start Postgres.',
            );
        }
        const pool = new Pool({ connectionString: url });
        const adapter = new PrismaPg(pool);
        super({ adapter });
        this.pool = pool;

        // Prisma v7 removed $use. Use $extends to auto-inject deletedAt:null
        // on read queries for soft-delete models. Delete→soft-delete is handled
        // at service level. findUnique is excluded (not composable with extra where).
        const extended = this.$extends({
            query: {
                $allModels: {
                    $allOperations({
                        model,
                        operation,
                        args,
                        query,
                    }: SoftDeleteQueryParams): Promise<unknown> {
                        if (
                            SOFT_DELETE_MODELS.has(model) &&
                            FILTER_ACTIONS.has(operation)
                        ) {
                            const a = args as Record<string, unknown>;
                            a.where = {
                                deletedAt: null,
                                ...((a.where as object | undefined) ?? {}),
                            };
                        }
                        return query(args);
                    },
                },
            },
        }) as PrismaClientWithLifecycle;

        // Attach NestJS lifecycle methods to the extended client because the
        // constructor return replaces `this` as the DI-injected instance.
        extended.onModuleInit = async () => {
            await this.$connect();
        };
        extended.onModuleDestroy = async () => {
            await this.$disconnect();
            await pool.end();
        };

        return extended as unknown as this;
    }

    // Satisfy the interface — replaced at runtime by the extended-client closures above.
    async onModuleInit() {
        await this.$connect();
    }

    async onModuleDestroy() {
        await this.$disconnect();
        await this.pool.end();
    }
}
