import { Test, TestingModule } from '@nestjs/testing';
import { INestApplication } from '@nestjs/common';
import request from 'supertest';
import { App } from 'supertest/types';
import { AppModule } from './../src/app.module';

describe('AppController (e2e)', () => {
    let app: INestApplication<App>;

    beforeEach(async () => {
        const moduleFixture: TestingModule = await Test.createTestingModule({
            imports: [AppModule],
        }).compile();

        app = moduleFixture.createNestApplication();
        await app.init();
    });

    it('/health/ready (GET) returns health with database probe', () => {
        return request(app.getHttpServer())
            .get('/health/ready')
            .expect(200)
            .expect((res) => {
                expect(res.body).toEqual(
                    expect.objectContaining({
                        ok: true,
                        service: 'landlord-management-api',
                        database: 'ok',
                    }),
                );
                expect(typeof res.body.time).toBe('string');
            });
    });

    afterEach(async () => {
        await app.close();
    });
});
