import { Test, TestingModule } from '@nestjs/testing';
import { INestApplication } from '@nestjs/common';
import request from 'supertest';
import { AppController } from '../src/app.controller';
import { AppService } from '../src/app.service';
import { HealthController } from '../src/health.controller';

describe('AppController (e2e)', () => {
  let app: INestApplication;

  beforeAll(async () => {
    const moduleFixture: TestingModule = await Test.createTestingModule({
      controllers: [AppController, HealthController],
      providers: [AppService],
    }).compile();

    app = moduleFixture.createNestApplication();
    await app.init();
  });

  afterAll(async () => {
    await app.close();
  });

  it('/ (GET)', () => {
    return request(app.getHttpServer())
      .get('/')
      .expect(200)
      .expect('Hello World!');
  });

  it('/health (GET)', () => {
    return request(app.getHttpServer())
      .get('/health')
      .expect(200)
      .expect((res) => {
        expect(res.body).toHaveProperty('ok', true);
        expect(res.body).toHaveProperty('service', 'all-axs-api');
        expect(res.body).toHaveProperty('ts');
      });
  });

  it('/version (GET)', () => {
    return request(app.getHttpServer())
      .get('/version')
      .expect(200)
      .expect((res) => {
        expect(res.body).toHaveProperty('version');
      });
  });
});
