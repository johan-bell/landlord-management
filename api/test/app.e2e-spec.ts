import { INestApplication } from '@nestjs/common';
import { Test, TestingModule } from '@nestjs/testing';
import type { Server } from 'http';
import request from 'supertest';
import { AppModule } from './../src/app.module';

describe('AppController (e2e)', () => {
    let app: INestApplication;

    beforeEach(async () => {
        const moduleFixture: TestingModule = await Test.createTestingModule({
            imports: [AppModule],
        }).compile();

        app = moduleFixture.createNestApplication();
        await app.init();
    });

    it('/health/ready (GET) returns health with database probe', () => {
        return request(app.getHttpServer() as Server)
            .get('/health/ready')
            .expect(200)
            .expect((res) => {
                const body = res.body as {
                    ok: boolean;
                    service: string;
                    database: string;
                    storage: string;
                    email: string;
                    time: string;
                };
                expect(body.ok).toBe(true);
                expect(body.service).toBe('landlord-management-api');
                expect(body.database).toBe('ok');
                expect(['configured', 'disabled']).toContain(body.storage);
                expect(['configured', 'disabled']).toContain(body.email);
                expect(typeof body.time).toBe('string');
            });
    });

    afterEach(async () => {
        await app.close();
    });
});
