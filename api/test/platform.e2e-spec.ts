import { Test, TestingModule } from '@nestjs/testing';
import { INestApplication } from '@nestjs/common';
import request from 'supertest';
import { App } from 'supertest/types';
import { AppModule } from './../src/app.module';

describe('Platform operator (e2e)', () => {
    let app: INestApplication<App>;

    beforeEach(async () => {
        const moduleFixture: TestingModule = await Test.createTestingModule({
            imports: [AppModule],
        }).compile();

        app = moduleFixture.createNestApplication();
        await app.init();
    });

    it('GET /platform/organizations without token returns 401', () => {
        return request(app.getHttpServer())
            .get('/platform/organizations')
            .expect(401);
    });

    it('GET /platform/health-overview without token returns 401', () => {
        return request(app.getHttpServer())
            .get('/platform/health-overview')
            .expect(401);
    });

    afterEach(async () => {
        await app.close();
    });
});
