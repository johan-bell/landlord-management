import { INestApplication } from '@nestjs/common';
import { Test, TestingModule } from '@nestjs/testing';
import type { Server } from 'http';
import request from 'supertest';
import { AppModule } from './../src/app.module';

describe('Platform operator (e2e)', () => {
    let app: INestApplication;

    beforeEach(async () => {
        const moduleFixture: TestingModule = await Test.createTestingModule({
            imports: [AppModule],
        }).compile();

        app = moduleFixture.createNestApplication();
        await app.init();
    });

    it('GET /platform/organizations without token returns 401', () => {
        return request(app.getHttpServer() as Server)
            .get('/platform/organizations')
            .expect(401);
    });

    it('GET /platform/health-overview without token returns 401', () => {
        return request(app.getHttpServer() as Server)
            .get('/platform/health-overview')
            .expect(401);
    });

    afterEach(async () => {
        await app.close();
    });
});
